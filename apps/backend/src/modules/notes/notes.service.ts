import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';
import type { ProjectsService } from '../projects/projects.service.js';
import { assertReadableTextFile, assertWritableFileTarget, safePath } from '../security/safe-path.js';
import type { NoteNodeDto, NotesSearchResult } from './notes.types.js';

const maxNoteSizeBytes = 5 * 1024 * 1024;

export class NotesService {
  constructor(private readonly projects: ProjectsService) {}

  async children(projectName: string, relativePath = '') {
    const root = await this.ensureNotesRoot(projectName);
    const directoryPath = safePath(root, relativePath);
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      throw Object.assign(new Error('Path is not a folder.'), { statusCode: 400 });
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.name.toLowerCase().endsWith('.md'))
        .map((entry) => this.toNode(root, relativePath, entry))
    );

    return {
      path: relativePath,
      items: items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    };
  }

  async read(projectName: string, relativePath: string) {
    const root = await this.ensureNotesRoot(projectName);
    const filePath = this.noteFilePath(root, relativePath);
    await assertReadableTextFile(filePath, maxNoteSizeBytes);
    return fs.readFile(filePath, 'utf8');
  }

  async createFile(projectName: string, relativePath: string, content = '') {
    const root = await this.ensureNotesRoot(projectName);
    const filePath = this.noteFilePath(root, this.withMarkdownExtension(relativePath));
    await assertWritableFileTarget(filePath, content, maxNoteSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
  }

  async write(projectName: string, relativePath: string, content: string) {
    const root = await this.ensureNotesRoot(projectName);
    const filePath = this.noteFilePath(root, relativePath);
    await assertWritableFileTarget(filePath, content, maxNoteSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  async createFolder(projectName: string, relativePath: string) {
    const root = await this.ensureNotesRoot(projectName);
    const folderPath = safePath(root, this.cleanRelativePath(relativePath));
    await fs.mkdir(folderPath, { recursive: true });
  }

  async rename(projectName: string, from: string, to: string) {
    const root = await this.ensureNotesRoot(projectName);
    const fromPath = safePath(root, this.cleanRelativePath(from));
    const stats = await fs.stat(fromPath);
    const toPath = stats.isDirectory()
      ? safePath(root, this.cleanRelativePath(to))
      : this.noteFilePath(root, this.withMarkdownExtension(to));
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
  }

  async duplicate(projectName: string, from: string, to: string) {
    const root = await this.ensureNotesRoot(projectName);
    const fromPath = safePath(root, this.cleanRelativePath(from));
    const stats = await fs.stat(fromPath);
    const toPath = stats.isDirectory()
      ? safePath(root, this.cleanRelativePath(to))
      : this.noteFilePath(root, this.withMarkdownExtension(to));
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.cp(fromPath, toPath, { recursive: stats.isDirectory(), errorOnExist: true, force: false });
  }

  async delete(projectName: string, relativePath: string) {
    if (!relativePath) {
      throw Object.assign(new Error('Cannot delete notes root.'), { statusCode: 400 });
    }
    const root = await this.ensureNotesRoot(projectName);
    await fs.rm(safePath(root, this.cleanRelativePath(relativePath)), { recursive: true, force: true });
  }

  async search(projectName: string, query: string): Promise<NotesSearchResult[]> {
    const root = await this.ensureNotesRoot(projectName);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return this.searchDirectory(root, '', normalizedQuery);
  }

  private async ensureNotesRoot(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.projects.ensureVibeIdeGitignore(projectPath);
    const notesRoot = safePath(projectPath, '.vibeide/notes');
    await fs.mkdir(notesRoot, { recursive: true });
    return notesRoot;
  }

  private async toNode(root: string, parentPath: string, entry: Dirent): Promise<NoteNodeDto> {
    const nodePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const fullPath = safePath(root, nodePath);
    const stats = await fs.stat(fullPath);
    const isDirectory = entry.isDirectory();
    return {
      name: entry.name,
      path: nodePath,
      type: isDirectory ? 'directory' : 'file',
      size: isDirectory ? undefined : stats.size,
      hasChildren: isDirectory ? await this.directoryHasChildren(fullPath) : undefined
    };
  }

  private async searchDirectory(root: string, relativePath: string, query: string): Promise<NotesSearchResult[]> {
    const directoryPath = safePath(root, relativePath);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const results: NotesSearchResult[] = [];

    for (const entry of entries) {
      const nodePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase().includes(query)) {
          results.push({ name: entry.name, path: nodePath, type: 'directory', match: 'name' });
        }
        results.push(...(await this.searchDirectory(root, nodePath, query)));
        continue;
      }

      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      const filePath = safePath(root, nodePath);
      const content = await fs.readFile(filePath, 'utf8').catch(() => '');
      const lowerContent = content.toLowerCase();
      if (entry.name.toLowerCase().includes(query)) {
        results.push({ name: entry.name, path: nodePath, type: 'file', match: 'name' });
      } else if (lowerContent.includes(query)) {
        results.push({ name: entry.name, path: nodePath, type: 'file', match: 'content', excerpt: this.excerpt(content, lowerContent.indexOf(query)) });
      }
    }

    return results.slice(0, 100);
  }

  private async directoryHasChildren(directoryPath: string) {
    const handle = await fs.opendir(directoryPath);
    try {
      return Boolean(await handle.read());
    } finally {
      await handle.close();
    }
  }

  private noteFilePath(root: string, relativePath: string) {
    const cleanPath = this.cleanRelativePath(relativePath);
    if (!cleanPath.toLowerCase().endsWith('.md')) {
      throw Object.assign(new Error('Notes must use the .md extension.'), { statusCode: 400 });
    }
    return safePath(root, cleanPath);
  }

  private withMarkdownExtension(relativePath: string) {
    const cleanPath = this.cleanRelativePath(relativePath);
    return cleanPath.toLowerCase().endsWith('.md') ? cleanPath : `${cleanPath}.md`;
  }

  private cleanRelativePath(relativePath: string) {
    return relativePath.replaceAll('\\', '/').replace(/^\/+/, '').trim();
  }

  private excerpt(content: string, index: number) {
    const start = Math.max(0, index - 60);
    const end = Math.min(content.length, index + 140);
    return content.slice(start, end).replace(/\s+/g, ' ').trim();
  }
}
