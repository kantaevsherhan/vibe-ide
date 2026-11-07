import fs from 'node:fs/promises';
import path from 'node:path';
import { createDefaultConfig, type VibeIdeConfig } from './default-config.js';

export class ConfigService {
  readonly path: string;
  private config?: VibeIdeConfig;

  constructor(private readonly projectRoot: string) {
    this.path = process.env.VIBEIDE_CONFIG ?? path.join(projectRoot, 'config', 'vibeide.config.json');
  }

  async load() {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      this.config = this.mergeConfig(JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<VibeIdeConfig>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

      this.config = createDefaultConfig(this.projectRoot);
      await fs.mkdir(path.dirname(this.path), { recursive: true });
      await fs.writeFile(this.path, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');
      console.warn(`[security] Created ${this.path}. Change the default password and sessionSecret before exposing VibeIDE.`);
    }

    const { VIBEIDE_PASSWORD, VIBEIDE_SESSION_SECRET, WORKSPACE_DIR } = process.env;
    if (VIBEIDE_PASSWORD) this.config.auth.password = VIBEIDE_PASSWORD;
    if (VIBEIDE_SESSION_SECRET) this.config.auth.sessionSecret = VIBEIDE_SESSION_SECRET;
    this.config.workspace.path = path.resolve(this.projectRoot, WORKSPACE_DIR || this.config.workspace.path);

    if (process.env.DOCKER_CONTAINER === '1') {
      if (!this.config.auth.enabled || this.config.auth.password === 'change-me' ||
          this.config.auth.sessionSecret === 'change-this-secret' || this.config.auth.sessionSecret.length < 32) {
        throw new Error('Docker requires authentication, a custom VIBEIDE_PASSWORD and a VIBEIDE_SESSION_SECRET of at least 32 characters.');
      }
    }

    if (this.config.auth.password === 'change-me' || this.config.auth.sessionSecret === 'change-this-secret') {
      console.warn('[security] Default credentials are active. Change auth.password and auth.sessionSecret in config/vibeide.config.json.');
    }

    return this.config;
  }

  get value() {
    if (!this.config) throw new Error('Config has not been loaded.');
    return this.config;
  }

  private mergeConfig(partial: Partial<VibeIdeConfig>): VibeIdeConfig {
    const defaults = createDefaultConfig(this.projectRoot);
    return {
      server: { ...defaults.server, ...partial.server },
      auth: { ...defaults.auth, ...partial.auth },
      workspace: { ...defaults.workspace, ...partial.workspace },
      security: { ...defaults.security, ...partial.security },
      ignore: { ...defaults.ignore, ...partial.ignore }
    };
  }
}
