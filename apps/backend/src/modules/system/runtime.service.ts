import fs from 'node:fs/promises';
import path from 'node:path';
import type { RuntimeInfo, RuntimeKind } from './update.types.js';

type RuntimeConfig = {
  runtime?: RuntimeKind;
  service?: string;
  processName?: string;
};

const supported = new Set<RuntimeKind>(['manual', 'pm2', 'systemd', 'docker', 'unknown']);

export class RuntimeService {
  readonly path: string;

  constructor(private readonly projectRoot: string) {
    this.path = path.join(projectRoot, 'config', 'runtime.json');
  }

  async getRuntime(): Promise<RuntimeInfo> {
    const config = await this.readConfig();
    if (config?.runtime && supported.has(config.runtime)) {
      return {
        runtime: config.runtime,
        service: config.service,
        processName: config.processName,
        source: 'config'
      };
    }

    const detected = await this.detect();
    return detected ?? { runtime: 'manual', source: 'default' };
  }

  private async readConfig(): Promise<RuntimeConfig | null> {
    const raw = await fs.readFile(this.path, 'utf8').catch(() => null);
    if (!raw) return null;
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as RuntimeConfig;
  }

  private async detect(): Promise<RuntimeInfo | null> {
    if (process.env.container || process.env.DOCKER_CONTAINER || await this.exists('/.dockerenv')) {
      return { runtime: 'docker', source: 'detected' };
    }

    if (process.env.PM2_HOME || process.env.pm_id || process.env.NODE_APP_INSTANCE) {
      return {
        runtime: 'pm2',
        processName: process.env.name || (process.env.pm_exec_path ? 'vibeide' : undefined),
        source: 'detected'
      };
    }

    if (process.env.INVOCATION_ID || process.env.JOURNAL_STREAM) {
      return { runtime: 'systemd', service: 'vibeide', source: 'detected' };
    }

    return null;
  }

  private async exists(nextPath: string) {
    return Boolean(await fs.stat(nextPath).catch(() => null));
  }
}
