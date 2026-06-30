import type { AgentsConfigFile } from './agents.types.js';

export class TelegramService {
  constructor(private readonly config: AgentsConfigFile) {}

  async sendTelegramMessage(text: string) {
    const telegram = this.config.notifications.telegram;
    if (!telegram.enabled || !telegram.botToken || !telegram.chatId) return;

    await fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram.chatId,
        text
      })
    });
  }
}
