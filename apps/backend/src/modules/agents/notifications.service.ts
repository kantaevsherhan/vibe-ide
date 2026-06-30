import type { AgentTask } from './agents.types.js';
import type { TelegramService } from './telegram.service.js';

export class NotificationsService {
  constructor(private readonly telegram: TelegramService) {}

  async taskDone(agentName: string, task: AgentTask) {
    await this.safeSend(`VibeIDE: ${agentName} finished a task in project ${task.projectName}`);
  }

  async taskError(agentName: string, task: AgentTask) {
    await this.safeSend(`VibeIDE: ${agentName} failed in project ${task.projectName}: ${task.error ?? 'Unknown error'}`);
  }

  async taskWaiting(agentName: string, task: AgentTask) {
    await this.safeSend(`VibeIDE: ${agentName} is waiting for input in project ${task.projectName}`);
  }

  async taskStopped(agentName: string, task: AgentTask) {
    await this.safeSend(`VibeIDE: ${agentName} stopped in project ${task.projectName}`);
  }

  private async safeSend(text: string) {
    try {
      await this.telegram.sendTelegramMessage(text);
    } catch {
      // Notifications must never break agent execution.
    }
  }
}
