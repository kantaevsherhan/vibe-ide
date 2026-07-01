import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { safePath } from '../security/safe-path.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { CreateProjectInput, Project, ProjectMetadata } from './projects.types.js';

export type TerminalCountProvider = (projectName: string) => number;
export type ProjectDeleteProvider = (projectName: string) => void | Promise<void>;
export type ProjectGitHealthProvider = (projectName: string) => Promise<{ changedFiles: number; clean: boolean; branch?: string | null }>;
export type ProjectAgentsHealthProvider = (projectName: string) => Promise<{ running: number; waiting: number; errors: number; activeTasks: number }>;

const projectNamePattern = /^[A-Za-z0-9_-]+$/;
const vibeIdeGitignore = ['agents/', 'sessions/', 'logs/', 'tasks.json', 'state.json'].join('\n') + '\n';
const scpLikeGitUrlPattern = /^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+:[A-Za-z0-9_.~/-]+(?:\.git)?$/;

export class ProjectsService {
  private terminalCountProvider: TerminalCountProvider = () => 0;
  private projectDeleteProvider: ProjectDeleteProvider = () => {};
  private gitHealthProvider: ProjectGitHealthProvider = async () => ({ changedFiles: 0, clean: true, branch: null });
  private agentsHealthProvider: ProjectAgentsHealthProvider = async () => ({ running: 0, waiting: 0, errors: 0, activeTasks: 0 });

  constructor(private readonly workspace: WorkspaceService) {}

  setTerminalCountProvider(provider: TerminalCountProvider) {
    this.terminalCountProvider = provider;
  }

  setProjectDeleteProvider(provider: ProjectDeleteProvider) {
    this.projectDeleteProvider = provider;
  }

  setGitHealthProvider(provider: ProjectGitHealthProvider) {
    this.gitHealthProvider = provider;
  }

  setAgentsHealthProvider(provider: ProjectAgentsHealthProvider) {
    this.agentsHealthProvider = provider;
  }

  assertProjectName(projectName: string) {
    if (!projectName || !projectNamePattern.test(projectName)) {
      throw Object.assign(new Error('Invalid project name.'), { statusCode: 400 });
    }
  }

  projectPath(projectName: string) {
    this.assertProjectName(projectName);
    return safePath(this.workspace.root, projectName);
  }

  async ensureProjectExists(projectName: string) {
    const projectPath = this.projectPath(projectName);
    const stats = await fs.stat(projectPath).catch(() => null);
    if (!stats?.isDirectory()) {
      throw Object.assign(new Error('Project was not found.'), { statusCode: 404 });
    }
    return projectPath;
  }

  async list(): Promise<Project[]> {
    const entries = await fs.readdir(this.workspace.root, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && projectNamePattern.test(entry.name))
        .map(async (entry) => this.readProject(entry.name))
    );

    return projects
      .filter((project): project is Project => Boolean(project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(projectName: string): Promise<Project> {
    const project = await this.readProject(projectName);
    if (!project) {
      throw Object.assign(new Error('Project was not found.'), { statusCode: 404 });
    }
    return project;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    this.assertProjectName(input.folderName);
    const source = input.source ?? 'blank';
    if (source !== 'blank' && source !== 'git') {
      throw Object.assign(new Error('Invalid project source.'), { statusCode: 400 });
    }
    const now = new Date().toISOString();
    const projectPath = this.projectPath(input.folderName);
    const existing = await fs.stat(projectPath).catch(() => null);
    if (existing) {
      throw Object.assign(new Error('Project folder already exists.'), { statusCode: 409 });
    }

    const metadata: ProjectMetadata = {
      name: input.name.trim() || input.folderName,
      folderName: input.folderName,
      description: input.description?.trim() || '',
      createdAt: now,
      updatedAt: now
    };

    if (source === 'git') {
      await this.cloneRepository(input.repositoryUrl, projectPath);
    } else {
      await fs.mkdir(projectPath, { recursive: true });
    }

    await this.writeMetadata(projectPath, metadata);
    return this.projectFromMetadata(projectNamePattern.test(input.folderName) ? input.folderName : metadata.folderName, projectPath, metadata);
  }

  async delete(projectName: string) {
    const projectPath = await this.ensureProjectExists(projectName);
    await this.projectDeleteProvider(projectName);
    await fs.rm(projectPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  async ensureVibeIdeGitignore(projectPath: string) {
    const gitignorePath = path.join(this.metadataDir(projectPath), '.gitignore');
    const current = await fs.readFile(gitignorePath, 'utf8').catch(() => '');
    const missingLines = vibeIdeGitignore
      .trim()
      .split('\n')
      .filter((line) => !current.split(/\r?\n/).includes(line));

    if (current && missingLines.length === 0) return;

    const next = current
      ? `${current.replace(/\s*$/, '\n')}${missingLines.join('\n')}\n`
      : vibeIdeGitignore;
    await fs.mkdir(this.metadataDir(projectPath), { recursive: true });
    await fs.writeFile(gitignorePath, next, 'utf8');
  }

  private async readProject(projectName: string): Promise<Project | null> {
    const projectPath = this.projectPath(projectName);
    const stats = await fs.stat(projectPath).catch(() => null);
    if (!stats?.isDirectory()) return null;

    const metadataPath = this.metadataPath(projectPath);
    const raw = await fs.readFile(metadataPath, 'utf8').catch(() => null);
    const metadata = raw
      ? (JSON.parse(raw.replace(/^\uFEFF/, '')) as ProjectMetadata)
      : await this.createMissingMetadata(projectName, projectPath);

    return this.projectFromMetadata(projectName, projectPath, metadata);
  }

  private async projectFromMetadata(projectName: string, projectPath: string, metadata: ProjectMetadata): Promise<Project> {
    const [git, agents] = await Promise.all([
      this.gitHealthProvider(projectName).catch(() => ({ changedFiles: 0, clean: true, branch: null })),
      this.agentsHealthProvider(projectName).catch(() => ({ running: 0, waiting: 0, errors: 0, activeTasks: 0 }))
    ]);
    const activeTerminals = this.terminalCountProvider(projectName);

    return {
      ...metadata,
      location: projectPath,
      activeTerminalsCount: activeTerminals,
      runtime: {
        activeTerminals,
        runningAgents: agents.running,
        activeTasks: agents.activeTasks
      },
      health: {
        gitChangedFiles: git.changedFiles,
        gitClean: git.clean,
        gitBranch: git.branch ?? null,
        terminalStatus: activeTerminals > 0 ? 'active' : 'inactive',
        agentStatus: this.agentStatus(agents)
      }
    };
  }

  private agentStatus(agents: { running: number; waiting: number; errors: number }): Project['health']['agentStatus'] {
    if (agents.errors > 0) return 'error';
    if (agents.waiting > 0) return 'waiting';
    if (agents.running > 0) return 'running';
    return 'idle';
  }

  private async createMissingMetadata(projectName: string, projectPath: string): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const metadata: ProjectMetadata = {
      name: projectName,
      folderName: projectName,
      description: '',
      createdAt: now,
      updatedAt: now
    };
    await this.writeMetadata(projectPath, metadata);
    return metadata;
  }

  private async writeMetadata(projectPath: string, metadata: ProjectMetadata) {
    await fs.mkdir(this.metadataDir(projectPath), { recursive: true });
    await this.ensureVibeIdeGitignore(projectPath);
    await fs.writeFile(this.metadataPath(projectPath), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  }

  private async cloneRepository(repositoryUrl: string | undefined, projectPath: string) {
    const repository = repositoryUrl?.trim();
    if (!repository || !this.isValidRepositoryUrl(repository)) {
      throw Object.assign(new Error('Invalid Git repository URL.'), { statusCode: 400 });
    }

    try {
      const result = await execa('git', ['clone', repository, projectPath], {
        cwd: this.workspace.root,
        reject: false,
        env: {
          ...process.env,
          GIT_CEILING_DIRECTORIES: path.dirname(this.workspace.root)
        }
      });

      if (result.exitCode !== 0) {
        throw Object.assign(new Error(result.stderr || 'Failed to clone repository.'), { statusCode: 400 });
      }
    } catch (error) {
      await fs.rm(projectPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      if (error instanceof Error && 'statusCode' in error) throw error;
      throw Object.assign(new Error('Failed to clone repository.'), { statusCode: 400, cause: error });
    }
  }

  private isValidRepositoryUrl(repositoryUrl: string) {
    if (/[\s\x00-\x1F]/.test(repositoryUrl)) return false;
    if (scpLikeGitUrlPattern.test(repositoryUrl)) return true;

    try {
      const parsed = new URL(repositoryUrl);
      return ['http:', 'https:', 'ssh:', 'git:'].includes(parsed.protocol) && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }

  private metadataDir(projectPath: string) {
    return path.join(projectPath, '.vibeide');
  }

  private metadataPath(projectPath: string) {
    return path.join(this.metadataDir(projectPath), 'project.json');
  }
}
