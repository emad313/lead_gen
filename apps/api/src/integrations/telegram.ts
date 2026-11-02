import { config } from '../config.js';

export async function notifyTelegram(message: string): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    return;
  }
  const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text: message })
  });
  if (!response.ok) {
    throw new Error(`Telegram notification failed with status ${response.status}`);
  }
}
