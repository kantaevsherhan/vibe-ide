import { RuntimeService } from './runtime.service.js';
import { UpdateService } from './update.service.js';

export class SystemService {
  readonly runtime: RuntimeService;
  readonly updates: UpdateService;

  constructor(projectRoot: string) {
    this.runtime = new RuntimeService(projectRoot);
    this.updates = new UpdateService(projectRoot, this.runtime);
  }
}
