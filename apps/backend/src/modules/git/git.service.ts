import { execa } from 'execa';
import type { VibeIdeConfig } from '../../config/default-config.js';
import { ensureGitAllowed } from '../security/permissions.js';
import { safePath } from '../security/safe-path.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';

export type GitFileStatus = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'unknown';
  raw: string;
};

export class GitService {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly config: VibeIdeConfig
  ) {}

  async status(): Promise<GitFileStatus[]> {
    ensureGitAllowed(this.config);
    const { stdout } = await this.git(['status', '--short']);
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const raw = line.slice(0, 2);
        const pathValue = line.slice(3).replace(/^.* -> /, '');
        return { path: pathValue, status: this.mapStatus(raw), raw };
      });
  }

  async diff(relativePath?: string) {
    ensureGitAllowed(this.config);
    const args = ['diff', '--'];
    if (relativePath) {
      safePath(this.workspace.root, relativePath);
      args.push(relativePath);
    }

    const { stdout } = await this.git(args);
    return stdout;
  }

  async diffNameOnly() {
    ensureGitAllowed(this.config);
    const { stdout } = await this.git(['diff', '--name-only']);
    return stdout.split('\n').filter(Boolean);
  }

  async log() {
    ensureGitAllowed(this.config);
    const { stdout } = await this.git(['log', '--oneline', '-20']);
    return stdout;
  }

  private async git(args: string[]) {
    try {
      return await execa('git', args, {
        cwd: this.workspace.root,
        reject: false
      });
    } catch (error) {
      throw Object.assign(new Error('Git command failed.'), { statusCode: 500, cause: error });
    }
  }

  private mapStatus(raw: string): GitFileStatus['status'] {
    if (raw.includes('?')) return 'untracked';
    if (raw.includes('A')) return 'added';
    if (raw.includes('D')) return 'deleted';
    if (raw.includes('R')) return 'renamed';
    if (raw.includes('M')) return 'modified';
    return 'unknown';
  }
}
