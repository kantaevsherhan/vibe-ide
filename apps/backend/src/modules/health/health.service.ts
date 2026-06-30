import type { AgentsService } from '../agents/agents.service.js';
import type { GitService } from '../git/git.service.js';
import type { TerminalService } from '../terminal/terminal.service.js';

export interface WorkspaceHealthResponse {
  git: {
    changedFiles: number;
    branch?: string | null;
    clean: boolean;
  };
  terminals: {
    active: number;
  };
  agents: {
    running: number;
    waiting: number;
    errors: number;
  };
}

export class HealthService {
  constructor(
    private readonly git: GitService,
    private readonly terminals: TerminalService,
    private readonly agents: AgentsService
  ) {}

  async workspace(projectName: string): Promise<WorkspaceHealthResponse> {
    const [git, agents] = await Promise.all([this.git.health(projectName), this.agents.health(projectName)]);
    return {
      git,
      terminals: {
        active: this.terminals.count(projectName)
      },
      agents
    };
  }
}
