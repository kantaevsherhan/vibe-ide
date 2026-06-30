import fs from 'node:fs/promises';
import path from 'node:path';
import { safePath } from '../security/safe-path.js';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { CreateProjectInput, Project, ProjectMetadata } from './projects.types.js';

export type TerminalCountProvider = (projectName: string) => number;

const projectNamePattern = /^[A-Za-z0-9_-]+$/;

export class ProjectsService {
  private terminalCountProvider: TerminalCountProvider = () => 0;

  constructor(private readonly workspace: WorkspaceService) {}

  setTerminalCountProvider(provider: TerminalCountProvider) {
    this.terminalCountProvider = provider;
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

    await fs.mkdir(this.metadataDir(projectPath), { recursive: true });
    await fs.writeFile(this.metadataPath(projectPath), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    return { ...metadata, activeTerminalsCount: 0 };
  }

  async delete(projectName: string) {
    const projectPath = await this.ensureProjectExists(projectName);
    await fs.rm(projectPath, { recursive: true, force: true });
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

    return {
      ...metadata,
      activeTerminalsCount: this.terminalCountProvider(projectName)
    };
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
    await fs.mkdir(this.metadataDir(projectPath), { recursive: true });
    await fs.writeFile(this.metadataPath(projectPath), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    return metadata;
  }

  private metadataDir(projectPath: string) {
    return path.join(projectPath, '.vibeide');
  }

  private metadataPath(projectPath: string) {
    return path.join(this.metadataDir(projectPath), 'project.json');
  }
}
