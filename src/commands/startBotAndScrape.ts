import TelegramBot from '../notifications/TelegramBot';
import env from '../env';

export const startBotAndScrape = async () => {
    if (!env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN env var not set!');
    }
    const channelId = env.CHAT_ID;
    if (!channelId) {
        throw new Error('CHAT_ID env var not set!');
    }
    const bot = new TelegramBot(env.BOT_TOKEN);
    return bot.scrape(async x => {
        await bot.sendMessage(channelId, x);
    });
};
