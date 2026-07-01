import type { AgentsConfigFile } from './agents.types.js';

export class TelegramService {
  constructor(private readonly getConfig: () => AgentsConfigFile) {}

  async sendTelegramMessage(text: string, override?: AgentsConfigFile['notifications']['telegram']) {
    const telegram = override ?? this.getConfig().notifications.telegram;
    if (!telegram.enabled || !telegram.botToken || !telegram.chatId) return;

    const response = await fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram.chatId,
        text
      })
    });

    if (!response.ok) {
      throw new Error('Telegram notification failed.');
    }
  }
}
