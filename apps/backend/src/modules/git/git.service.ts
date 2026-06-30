import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { ensureGitAllowed } from '../security/permissions.js';
import { safePath } from '../security/safe-path.js';

export type GitFileStatus = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'unknown';
  raw: string;
};

export type GitStatusResult = {
  isRepository: boolean;
  message?: string;
  files: GitFileStatus[];
};

export class GitService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly config: VibeIdeConfig
  ) {}

  async status(projectName: string): Promise<GitStatusResult> {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    if (!(await this.hasProjectGit(projectPath))) {
      return {
        isRepository: false,
        message: 'This project is not a Git repository.',
        files: []
      };
    }
    const { stdout } = await this.git(projectPath, ['status', '--short']);
    return {
      isRepository: true,
      files: stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const raw = line.slice(0, 2);
          const pathValue = line.slice(3).replace(/^.* -> /, '');
          return { path: pathValue, status: this.mapStatus(raw), raw };
        })
    };
  }

  async diff(projectName: string, relativePath?: string) {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    const args = ['diff', '--'];
    if (relativePath) {
      safePath(projectPath, relativePath);
      args.push(relativePath);
    }

    const { stdout } = await this.git(projectPath, args);
    return stdout;
  }

  async diffNameOnly(projectName: string) {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    const { stdout } = await this.git(projectPath, ['diff', '--name-only']);
    return stdout.split('\n').filter(Boolean);
  }

  async log(projectName: string) {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    const { stdout } = await this.git(projectPath, ['log', '--oneline', '-20']);
    return stdout;
  }

  private async git(cwd: string, args: string[]) {
    try {
      return await execa('git', args, {
        cwd,
        reject: false
      });
    } catch (error) {
      throw Object.assign(new Error('Git command failed.'), { statusCode: 500, cause: error });
    }
  }

  private async hasProjectGit(projectPath: string) {
    const gitPath = path.join(projectPath, '.git');
    const stats = await fs.stat(gitPath).catch(() => null);
    return Boolean(stats && (stats.isDirectory() || stats.isFile()));
  }

  private async ensureProjectGit(projectPath: string) {
    if (await this.hasProjectGit(projectPath)) return;
    throw Object.assign(new Error('This project is not a Git repository.'), { statusCode: 404 });
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
