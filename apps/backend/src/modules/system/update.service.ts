import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { UpdateLogs } from './update.logs.js';
import type { RuntimeInfo, StartUpdateInput, StartUpdateResponse, UpdateJob, UpdateJobStatus, UpdateStatusResponse, UpdateStrategy } from './update.types.js';
import type { RuntimeService } from './runtime.service.js';

const ignoredLocalChangePrefixes = [
  '.vibeide/',
  'logs/',
  'data/',
  'storage/',
  'config/settings.json',
  'config/runtime.json',
  'config/agents.config.json'
];

type CommandResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

type LocalChange = {
  raw: string;
  path: string;
  untracked: boolean;
};

export class UpdateService {
  private readonly logs: UpdateLogs;
  private readonly jobs = new Map<string, UpdateJob>();
  private currentUpdateJob: UpdateJob | null = null;

  constructor(
    private readonly projectRoot: string,
    private readonly runtime: RuntimeService
  ) {
    this.logs = new UpdateLogs(projectRoot);
  }

  async start(input: StartUpdateInput = {}): Promise<StartUpdateResponse> {
    if (this.currentUpdateJob && !this.isFinished(this.currentUpdateJob.status)) {
      throw Object.assign(new Error('Update is already running'), {
        statusCode: 409,
        jobId: this.currentUpdateJob.jobId
      });
    }

    const jobId = randomUUID();
    const logPath = await this.logs.pathFor(jobId);
    const runtime = await this.runtime.getRuntime();
    const job: UpdateJob = {
      jobId,
      status: 'checking',
      message: 'Update started',
      startedAt: new Date().toISOString(),
      runtime,
      restartStatus: 'Not started',
      logPath
    };

    this.jobs.set(jobId, job);
    this.currentUpdateJob = job;
    void this.run(job, input.strategy ?? 'cancel');

    return {
      jobId,
      status: 'running',
      message: 'Update started'
    };
  }

  status(jobId: string): UpdateStatusResponse {
    const job = this.getJob(jobId);
    const { logPath: _logPath, ...publicJob } = job;
    return publicJob;
  }

  async readLogs(jobId: string) {
    const job = this.getJob(jobId);
    return {
      jobId,
      logs: await this.logs.read(job.logPath)
    };
  }

  private async run(job: UpdateJob, strategy: UpdateStrategy) {
    await this.write(job, `Update job ${job.jobId} started at ${job.startedAt}\n`);
    await this.write(job, `Runtime: ${job.runtime?.runtime ?? 'manual'}\n`);

    try {
      await this.setStatus(job, 'checking', 'Checking updates...');
      const localChanges = await this.sourceLocalChanges();
      if (localChanges.length > 0) {
        await this.handleLocalChanges(job, strategy, localChanges);
      }

      await this.command(job, 'git fetch origin', 'git', ['fetch', 'origin'], 'Git fetch failed');
      const current = (await this.command(job, 'git rev-parse HEAD', 'git', ['rev-parse', 'HEAD'], 'Failed to read current version')).stdout.trim();
      const latest = (await this.command(job, 'git rev-parse origin/main', 'git', ['rev-parse', 'origin/main'], 'Failed to read latest version')).stdout.trim();
      job.currentVersion = current;
      job.latestVersion = latest;

      if (current === latest) {
        job.hasUpdates = false;
        await this.finish(job, 'finished', 'Already up to date.', undefined);
        return;
      }

      job.hasUpdates = true;
      await this.setStatus(job, 'downloading', 'Downloading updates...');
      await this.command(job, 'git pull --ff-only origin main', 'git', ['pull', '--ff-only', 'origin', 'main'], 'Git pull failed');

      await this.setStatus(job, 'installing', 'Installing dependencies...');
      await this.command(job, 'npm install', 'npm', ['install'], 'npm install failed');

      await this.setStatus(job, 'building', 'Building project...');
      await this.command(job, 'npm run build', 'npm', ['run', 'build'], 'Build failed');

      await this.handleRestart(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      await this.finish(job, 'failed', message, message);
    }
  }

  private async handleLocalChanges(job: UpdateJob, strategy: UpdateStrategy, changes: LocalChange[]) {
    await this.write(job, `Local source changes detected:\n${changes.map((change) => `- ${change.path}`).join('\n')}\n`);
    if (strategy === 'cancel') {
      throw new Error('Local source changes detected. Commit, stash, or choose Stash & Update / Force Update.');
    }

    if (strategy === 'stash') {
      await this.command(
        job,
        'git stash push source changes',
        'git',
        ['stash', 'push', '--include-untracked', '-m', `vibeide-update-${job.jobId}`, '--', ...changes.map((change) => change.path)],
        'Git stash failed'
      );
      return;
    }

    const tracked = changes.filter((change) => !change.untracked).map((change) => change.path);
    if (tracked.length > 0) {
      await this.command(job, 'git reset local source changes', 'git', ['checkout', '--', ...tracked], 'Force update failed');
    }
    const untracked = changes.filter((change) => change.untracked).map((change) => change.path);
    if (untracked.length > 0) {
      await this.command(job, 'git clean local source changes', 'git', ['clean', '-fd', '--', ...untracked], 'Force update failed');
    }
  }

  private async handleRestart(job: UpdateJob) {
    await this.setStatus(job, 'waiting_restart', 'Update completed. Preparing restart strategy...');
    const runtime = job.runtime ?? { runtime: 'manual', source: 'default' as const };

    if (runtime.runtime === 'pm2') {
      const processName = runtime.processName || 'vibeide';
      job.restartStatus = `PM2 restart scheduled for ${processName}`;
      await this.write(job, `Restart strategy: pm2 restart ${processName}\n`);
      this.spawnDetached('pm2', ['restart', processName]);
      await this.finish(job, 'finished', 'Update completed successfully. PM2 restart was scheduled.', undefined);
      return;
    }

    if (runtime.runtime === 'systemd') {
      if (!runtime.service) {
        job.restartStatus = 'systemd service is not configured';
        await this.finish(job, 'finished', 'Update completed successfully. Please restart VibeIDE manually.', undefined);
        return;
      }
      job.restartStatus = `systemd restart scheduled for ${runtime.service}`;
      await this.write(job, `Restart strategy: systemctl restart ${runtime.service}\n`);
      this.spawnDetached('systemctl', ['restart', runtime.service]);
      await this.finish(job, 'finished', 'Update completed successfully. systemd restart was scheduled.', undefined);
      return;
    }

    if (runtime.runtime === 'docker') {
      job.restartStatus = 'Please restart the container.';
      await this.finish(job, 'finished', 'Update completed successfully. Please restart the container.', undefined);
      return;
    }

    job.restartStatus = 'Please restart VibeIDE manually.';
    await this.finish(job, 'finished', 'Update completed successfully. Please restart VibeIDE manually.', undefined);
  }

  private async sourceLocalChanges() {
    const status = await this.command(null, 'git status --porcelain', 'git', ['status', '--porcelain'], 'Git status failed');
    return status.stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line): LocalChange => {
        const rawPath = line.slice(3).replace(/^.* -> /, '');
        return { raw: line.slice(0, 2), path: rawPath.replace(/\\/g, '/'), untracked: line.startsWith('??') };
      })
      .filter((change) => !this.isIgnoredLocalChange(change.path));
  }

  private isIgnoredLocalChange(filePath: string) {
    return ignoredLocalChangePrefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
  }

  private async setStatus(job: UpdateJob, status: UpdateJobStatus, message: string) {
    job.status = status;
    job.message = message;
    await this.write(job, `${message}\n`);
  }

  private async finish(job: UpdateJob, status: UpdateJobStatus, message: string, error: string | undefined) {
    if (this.isFinished(job.status)) return;
    job.status = status;
    job.message = message;
    job.finishedAt = new Date().toISOString();
    job.error = error;
    await this.write(job, `${message}\nUpdate job finished at ${job.finishedAt}\n`);
    if (this.currentUpdateJob?.jobId === job.jobId) this.currentUpdateJob = null;
  }

  private async command(job: UpdateJob | null, label: string, command: string, args: string[], errorLabel: string): Promise<CommandResult> {
    if (job) await this.write(job, `$ ${label}\n`);
    const result = await this.runCommand(command, args, job);
    if (result.code !== 0) {
      throw new Error(`${errorLabel}: ${result.stderr || result.stdout || `exit code ${result.code ?? 'unknown'}`}`.trim());
    }
    return result;
  }

  private runCommand(command: string, args: string[], job: UpdateJob | null): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.projectRoot,
        env: process.env,
        shell: process.platform === 'win32',
        windowsHide: true
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        if (job) void this.write(job, text);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        if (job) void this.write(job, text);
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ stdout, stderr, code }));
    });
  }

  private spawnDetached(command: string, args: string[]) {
    const child = spawn(command, args, {
      cwd: this.projectRoot,
      env: process.env,
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
      windowsHide: true
    });
    child.unref();
  }

  private async write(job: UpdateJob, text: string) {
    await this.logs.append(job.logPath, text);
  }

  private getJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) throw Object.assign(new Error('Update job was not found.'), { statusCode: 404 });
    return job;
  }

  private isFinished(status: UpdateJobStatus) {
    return status === 'finished' || status === 'failed';
  }
}
