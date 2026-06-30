import fs from 'node:fs/promises';
import path from 'node:path';
import type { VibeIdeConfig } from '../../config/default-config.js';

export class WorkspaceService {
  readonly root: string;

  constructor(config: VibeIdeConfig) {
    this.root = path.resolve(process.env.WORKSPACE_DIR ?? config.workspace.path);
  }

  async ensureReady() {
    await fs.mkdir(this.root, { recursive: true });
  }
}
