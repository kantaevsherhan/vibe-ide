import fs from 'node:fs/promises';
import path from 'node:path';

export class UpdateLogs {
  readonly root: string;

  constructor(projectRoot: string) {
    this.root = path.join(projectRoot, 'data', 'update-logs');
  }

  async pathFor(jobId: string) {
    await fs.mkdir(this.root, { recursive: true });
    return path.join(this.root, `${jobId}.log`);
  }

  async append(logPath: string, message: string) {
    await fs.appendFile(logPath, message, 'utf8');
  }

  async read(logPath: string) {
    return fs.readFile(logPath, 'utf8').catch(() => '');
  }
}
