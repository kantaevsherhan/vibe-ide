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
  branch?: string | null;
};

export type GitCommitResult = {
  ok: true;
  commit: string;
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
    const [{ stdout }, { stdout: branch }] = await Promise.all([
      this.git(projectPath, ['status', '--short']),
      this.git(projectPath, ['branch', '--show-current'])
    ]);
    return {
      isRepository: true,
      branch: branch || null,
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

  async init(projectName: string): Promise<GitStatusResult> {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    if (!(await this.hasProjectGit(projectPath))) {
      await this.git(projectPath, ['init']);
    }

    return this.status(projectName);
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

  async branches(projectName: string) {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    await this.git(projectPath, ['fetch', '--all', '--prune']).catch(() => null);
    const [{ stdout: branches }, { stdout: remoteBranches }, { stdout: current }] = await Promise.all([
      this.git(projectPath, ['branch', '--format=%(refname:short)']),
      this.git(projectPath, ['branch', '-r', '--format=%(refname:short)']),
      this.git(projectPath, ['branch', '--show-current'])
    ]);
    const localBranches = branches.split('\n').map((branch) => branch.trim()).filter(Boolean);
    const normalizedRemoteBranches = remoteBranches
      .split('\n')
      .map((branch) => branch.trim())
      .filter((branch) => branch && !branch.endsWith('/HEAD'))
      .map((branch) => branch.replace(/^origin\//, ''));
    const allBranches = [...new Set([...localBranches, ...normalizedRemoteBranches])].sort((a, b) => a.localeCompare(b));
    return {
      current: current || null,
      branches: allBranches
    };
  }

  async checkout(projectName: string, branch: string) {
    ensureGitAllowed(this.config);
    if (!branch || branch.includes('..') || branch.startsWith('-')) {
      throw Object.assign(new Error('Invalid branch name.'), { statusCode: 400 });
    }
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    const localBranches = (await this.git(projectPath, ['branch', '--format=%(refname:short)'])).stdout
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (localBranches.includes(branch)) {
      await this.git(projectPath, ['checkout', branch]);
    } else {
      await this.git(projectPath, ['checkout', '-b', branch, '--track', `origin/${branch}`]);
    }
    return this.branches(projectName);
  }

  async commit(projectName: string, message: string): Promise<GitCommitResult> {
    ensureGitAllowed(this.config);
    const cleanMessage = message.trim();
    if (!cleanMessage) throw Object.assign(new Error('Commit message is required.'), { statusCode: 400 });
    const projectPath = await this.projects.ensureProjectExists(projectName);
    await this.ensureProjectGit(projectPath);
    await this.git(projectPath, ['add', '-A']);
    const status = (await this.git(projectPath, ['status', '--short'])).stdout;
    if (!status.trim()) throw Object.assign(new Error('No changes to commit.'), { statusCode: 400 });
    await this.git(projectPath, ['commit', '-m', cleanMessage]);
    const { stdout } = await this.git(projectPath, ['rev-parse', '--short', 'HEAD']);
    return { ok: true, commit: stdout.trim() };
  }

  async health(projectName: string) {
    ensureGitAllowed(this.config);
    const projectPath = await this.projects.ensureProjectExists(projectName);
    if (!(await this.hasProjectGit(projectPath))) {
      return {
        changedFiles: 0,
        branch: null,
        clean: true
      };
    }

    const [{ stdout: status }, { stdout: branch }] = await Promise.all([
      this.git(projectPath, ['status', '--short']),
      this.git(projectPath, ['branch', '--show-current'])
    ]);
    const changedFiles = status.split('\n').filter(Boolean).length;
    return {
      changedFiles,
      branch: branch || null,
      clean: changedFiles === 0
    };
  }

  private async git(cwd: string, args: string[]) {
    try {
      const result = await execa('git', args, {
        cwd,
        reject: false,
        env: {
          ...process.env,
          GIT_CEILING_DIRECTORIES: path.dirname(cwd)
        }
      });
      if (result.exitCode !== 0) {
        throw Object.assign(new Error(result.stderr || 'Git command failed.'), { statusCode: 500 });
      }
      return result;
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) throw error;
      throw Object.assign(new Error('Git command failed.'), { statusCode: 500, cause: error });
    }
  }

  private async hasProjectGit(projectPath: string) {
    const gitPath = path.join(projectPath, '.git');
    const stats = await fs.stat(gitPath).catch(() => null);
    return Boolean(stats?.isDirectory());
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
