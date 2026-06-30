import fs from 'node:fs/promises';
import path from 'node:path';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { FileNodeDto, FileTreeNode, FolderChildrenResponse } from '../../types/file.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { assertReadableTextFile, assertWritableFileTarget, safePath } from '../security/safe-path.js';
import type { IgnoreService } from '../workspace/ignore.service.js';

const binaryExtensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'zip',
  'rar',
  '7z',
  'exe',
  'dll',
  'so',
  'dmg',
  'mp4',
  'mov',
  'pdf'
]);

export class FilesService {
  private readonly maxFileSizeBytes: number;
  private readonly maxFolderChildren: number;

  constructor(
    private readonly projects: ProjectsService,
    private readonly ignore: IgnoreService,
    config: VibeIdeConfig
  ) {
    this.maxFileSizeBytes = config.security.maxFileSizeMb * 1024 * 1024;
    this.maxFolderChildren = config.workspace.maxFolderChildren;
  }

  async tree(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    return this.readDirectory(projectPath, '');
  }

  async children(projectName: string, relativePath = '', force = false): Promise<FolderChildrenResponse> {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const directoryPath = safePath(projectPath, relativePath);
    const stats = await fs.stat(directoryPath);
    if (!stats.isDirectory()) {
      throw Object.assign(new Error('Path is not a directory.'), { statusCode: 400 });
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    if (entries.length > this.maxFolderChildren) {
      return {
        path: relativePath,
        items: [],
        limited: true,
        total: entries.length,
        message: 'Folder is too large to display'
      };
    }

    const items = await Promise.all(
      entries.map(async (entry) => {
        const nodePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const ignored = await this.ignore.isIgnoredPath(projectName, nodePath);
        return this.toNodeDto(projectName, projectPath, nodePath, entry, ignored, force);
      })
    );

    return {
      path: relativePath,
      items: items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
      limited: false
    };
  }

  async read(projectName: string, relativePath: string, force = false) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const filePath = safePath(projectPath, relativePath);
    if (this.isBinaryByExtension(relativePath)) {
      throw Object.assign(new Error('Binary file preview is not supported.'), { statusCode: 415 });
    }
    await assertReadableTextFile(filePath, force ? Number.MAX_SAFE_INTEGER : this.maxFileSizeBytes);
    return fs.readFile(filePath, 'utf8');
  }

  async write(projectName: string, relativePath: string, content: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const filePath = safePath(projectPath, relativePath);
    await assertWritableFileTarget(filePath, content, this.maxFileSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  async createFile(projectName: string, relativePath: string, content = '') {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const filePath = safePath(projectPath, relativePath);
    await assertWritableFileTarget(filePath, content, this.maxFileSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
  }

  async createFolder(projectName: string, relativePath: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const folderPath = safePath(projectPath, relativePath);
    await fs.mkdir(folderPath, { recursive: true });
  }

  async delete(projectName: string, relativePath: string) {
    if (!relativePath) {
      throw Object.assign(new Error('Cannot delete project root.'), { statusCode: 400 });
    }

    const projectPath = await this.projects.ensureProjectExists(projectName);
    const targetPath = safePath(projectPath, relativePath);
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  private async readDirectory(projectPath: string, relativePath: string): Promise<FileTreeNode[]> {
    const directoryPath = safePath(projectPath, relativePath);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const nodes = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.git') && entry.name !== '.vibeide')
        .map(async (entry) => {
          const nodePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const node: FileTreeNode = {
            name: entry.name,
            path: nodePath,
            type: entry.isDirectory() ? 'directory' : 'file'
          };

          if (entry.isDirectory()) {
            node.children = await this.readDirectory(projectPath, nodePath);
          }

          return node;
        })
    );

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private async toNodeDto(
    projectName: string,
    projectPath: string,
    nodePath: string,
    entry: import('node:fs').Dirent,
    isIgnored: boolean,
    force: boolean
  ): Promise<FileNodeDto> {
    const fullPath = safePath(projectPath, nodePath);
    const stats = await fs.stat(fullPath);
    const isDirectory = entry.isDirectory();
    const dto: FileNodeDto = {
      name: entry.name,
      path: nodePath,
      type: isDirectory ? 'directory' : 'file',
      isIgnored,
      size: isDirectory ? undefined : stats.size
    };

    if (isDirectory) {
      dto.hasChildren = isIgnored && !force ? true : await this.directoryHasChildren(fullPath);
    } else {
      dto.isBinary = this.isBinaryByExtension(entry.name);
    }

    return dto;
  }

  private async directoryHasChildren(directoryPath: string) {
    const handle = await fs.opendir(directoryPath);
    try {
      const entry = await handle.read();
      return Boolean(entry);
    } finally {
      await handle.close();
    }
  }

  private isBinaryByExtension(filePath: string) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return Boolean(extension && binaryExtensions.has(extension));
  }
}
