import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  adminTelegramIds: String(process.env.ADMIN_TELEGRAM_ID || '123456789').split(',').map(id => id.trim()),
  mongoUri: process.env.MONGODB_URI || '',
  proxyUrl: process.env.PROXY_URL || '',
};
