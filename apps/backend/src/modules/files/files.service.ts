import fs from 'node:fs/promises';
import path from 'node:path';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { FileTreeNode } from '../../types/file.js';
import { assertReadableTextFile, assertWritableFileTarget, safePath } from '../security/safe-path.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export class FilesService {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly workspace: WorkspaceService,
    config: VibeIdeConfig
  ) {
    this.maxFileSizeBytes = config.security.maxFileSizeMb * 1024 * 1024;
  }

  async tree() {
    return this.readDirectory('');
  }

  async read(relativePath: string) {
    const filePath = safePath(this.workspace.root, relativePath);
    await assertReadableTextFile(filePath, this.maxFileSizeBytes);
    return fs.readFile(filePath, 'utf8');
  }

  async write(relativePath: string, content: string) {
    const filePath = safePath(this.workspace.root, relativePath);
    await assertWritableFileTarget(filePath, content, this.maxFileSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  async createFile(relativePath: string, content = '') {
    const filePath = safePath(this.workspace.root, relativePath);
    await assertWritableFileTarget(filePath, content, this.maxFileSizeBytes);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
  }

  async createFolder(relativePath: string) {
    const folderPath = safePath(this.workspace.root, relativePath);
    await fs.mkdir(folderPath, { recursive: true });
  }

  async delete(relativePath: string) {
    if (!relativePath) {
      throw Object.assign(new Error('Cannot delete workspace root.'), { statusCode: 400 });
    }

    const targetPath = safePath(this.workspace.root, relativePath);
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  private async readDirectory(relativePath: string): Promise<FileTreeNode[]> {
    const directoryPath = safePath(this.workspace.root, relativePath);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const nodes = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith('.git'))
        .map(async (entry) => {
          const nodePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          const node: FileTreeNode = {
            name: entry.name,
            path: nodePath,
            type: entry.isDirectory() ? 'directory' : 'file'
          };

          if (entry.isDirectory()) {
            node.children = await this.readDirectory(nodePath);
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
