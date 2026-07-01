import { UpdateService } from './update.service.js';

export class SystemService {
  readonly updates: UpdateService;

  constructor(projectRoot: string) {
    this.updates = new UpdateService(projectRoot);
  }
}
