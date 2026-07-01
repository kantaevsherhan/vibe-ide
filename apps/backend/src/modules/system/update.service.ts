import { spawn } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UpdateLogs } from './update.logs.js';
import type { StartUpdateResponse, UpdateJob, UpdateStatusResponse, UpdateJobStatus } from './update.types.js';

export class UpdateService {
  private readonly logs: UpdateLogs;
  private readonly jobs = new Map<string, UpdateJob>();
  private currentUpdateJob: UpdateJob | null = null;

  constructor(private readonly projectRoot: string) {
    this.logs = new UpdateLogs(projectRoot);
  }

  async start(): Promise<StartUpdateResponse> {
    if (this.currentUpdateJob && !this.isFinished(this.currentUpdateJob.status)) {
      throw Object.assign(new Error('Update is already running'), {
        statusCode: 409,
        jobId: this.currentUpdateJob.jobId
      });
    }

    const jobId = randomUUID();
    const logPath = await this.logs.pathFor(jobId);
    const job: UpdateJob = {
      jobId,
      status: 'checking',
      message: 'Update started',
      startedAt: new Date().toISOString(),
      logPath
    };

    this.jobs.set(jobId, job);
    this.currentUpdateJob = job;
    void this.run(job);

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

  private async run(job: UpdateJob) {
    await this.write(job, `Update job ${job.jobId} started at ${job.startedAt}\n`);

    const script = path.join(this.projectRoot, 'scripts', 'update.sh');
    const child = spawn('bash', [script], {
      cwd: this.projectRoot,
      env: process.env,
      windowsHide: true
    });

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this.updateStage(job, text);
      void this.write(job, text);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      void this.write(job, chunk.toString());
    });

    child.on('error', (error) => {
      void this.finish(job, 'error', `Update failed: ${error.message}`, error.message, 1);
    });

    child.on('close', (code) => {
      if (code === 0) {
        void this.finish(job, 'done', 'Update completed successfully. Please restart VibeIDE to apply changes.', undefined, code);
        return;
      }

      void this.finish(job, 'error', 'Update failed', `Update process exited with code ${code ?? 'unknown'}.`, code);
    });
  }

  private updateStage(job: UpdateJob, output: string) {
    const normalized = output.toLowerCase();
    if (normalized.includes('already up to date')) {
      job.hasUpdates = false;
      job.message = 'VibeIDE is already up to date';
    }
    if (normalized.includes('pulling latest changes')) {
      job.status = 'updating';
      job.hasUpdates = true;
      job.message = 'Pulling latest changes...';
    } else if (normalized.includes('installing dependencies')) {
      job.status = 'installing';
      job.message = 'Installing dependencies...';
    } else if (normalized.includes('building project')) {
      job.status = 'building';
      job.message = 'Building project...';
    } else if (normalized.includes('checking git updates')) {
      job.status = 'checking';
      job.message = 'Checking updates...';
    }
  }

  private async finish(job: UpdateJob, status: UpdateJobStatus, message: string, error: string | undefined, code: number | null) {
    if (this.isFinished(job.status)) return;
    job.status = status;
    job.message = message;
    job.finishedAt = new Date().toISOString();
    job.error = error;
    await this.write(job, `\nUpdate job finished at ${job.finishedAt}\nExit code: ${code ?? 'unknown'}\n`);
    if (this.currentUpdateJob?.jobId === job.jobId) this.currentUpdateJob = null;
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
    return status === 'done' || status === 'error';
  }
}
