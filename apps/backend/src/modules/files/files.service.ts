import fs from 'node:fs/promises';
import path from 'node:path';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { FileTreeNode } from '../../types/file.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { assertReadableTextFile, assertWritableFileTarget, safePath } from '../security/safe-path.js';

export class FilesService {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly projects: ProjectsService,
    config: VibeIdeConfig
  ) {
    this.maxFileSizeBytes = config.security.maxFileSizeMb * 1024 * 1024;
  }

  async tree(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    return this.readDirectory(projectPath, '');
  }

  async read(projectName: string, relativePath: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const filePath = safePath(projectPath, relativePath);
    await assertReadableTextFile(filePath, this.maxFileSizeBytes);
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
}
