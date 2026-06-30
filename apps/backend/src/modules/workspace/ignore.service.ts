import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import type { VibeIdeConfig } from '../../config/default-config.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { safePath } from '../security/safe-path.js';
import { getDefaultIgnoreRules } from './ignore.rules.js';

export class IgnoreService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly config: VibeIdeConfig
  ) {}

  getDefaultIgnoreRules() {
    return getDefaultIgnoreRules();
  }

  async loadVibeIgnore(projectName: string) {
    const projectPath = await this.projects.ensureProjectExists(projectName);
    const ignoreFile = this.config.ignore.vibeIgnoreFile || '.vibeignore';
    const ignorePath = safePath(projectPath, ignoreFile);
    const raw = await fs.readFile(ignorePath, 'utf8').catch(() => '');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  }

  async isIgnoredPath(projectName: string, relativePath: string) {
    if (!this.config.ignore.enabled || !relativePath) return false;
    const matcher = await this.createMatcher(projectName);
    return matcher.ignores(this.normalizeForIgnore(relativePath));
  }

  async createMatcher(projectName: string) {
    const rules = [
      ...(this.config.ignore.useDefaultRules ? this.getDefaultIgnoreRules() : []),
      ...(await this.loadVibeIgnore(projectName))
    ];
    return ignore().add(rules);
  }

  normalizeForIgnore(relativePath: string) {
    return relativePath.split(path.sep).join('/');
  }
}
