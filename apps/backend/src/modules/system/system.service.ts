import { execa } from 'execa';
import type { SystemUpdateResult } from './system.types.js';

export class SystemService {
  private updating = false;

  constructor(private readonly projectRoot: string) {}

  async checkUpdate(): Promise<SystemUpdateResult> {
    if (this.updating) {
      throw Object.assign(new Error('Update is already running.'), { statusCode: 409 });
    }

    this.updating = true;
    const logs: string[] = [];

    try {
      logs.push('Checking updates...');
      await this.run('git', ['fetch', 'origin']);
      const status = await this.run('git', ['status', '-uno']);

      if (!this.hasUpdates(status.stdout)) {
        logs.push('Done.');
        return {
          updated: false,
          message: 'VibeIDE is already up to date',
          logs
        };
      }

      logs.push('Pulling latest changes...');
      await this.run('git', ['pull', 'origin', 'main']);

      logs.push('Installing dependencies...');
      await this.run('npm', ['install']);

      logs.push('Building project...');
      await this.run('npm', ['run', 'build']);

      logs.push('Done.');
      return {
        updated: true,
        message: 'VibeIDE updated successfully. Please restart the server.',
        logs
      };
    } catch (error) {
      logs.push('Update failed.');
      const message = error instanceof Error ? error.message : 'Update failed.';
      throw Object.assign(new Error(message), { statusCode: 500, logs });
    } finally {
      this.updating = false;
    }
  }

  private hasUpdates(status: string) {
    const normalized = status.toLowerCase();
    return normalized.includes('your branch is behind') || normalized.includes('have diverged');
  }

  private async run(command: string, args: string[]) {
    const result = await execa(command, args, {
      cwd: this.projectRoot,
      reject: false,
      env: process.env
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || `${command} ${args.join(' ')} failed.`);
    }

    return result;
  }
}
