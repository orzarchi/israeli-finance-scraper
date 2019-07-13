import env from '../env';
import TelegramBot from '../notifications/TelegramBot';

export const startBot = async () => {
    if (!env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN env var not set!');
    }
    if (!env.HEROKU_ADDRESS) {
        throw new Error('HEROKU_ADDRESS env var not set!');
    }

    try {
        await new TelegramBot(env.BOT_TOKEN).launchBot(env.HEROKU_ADDRESS, env.HEROKU_PORT);
    } catch (x) {
        console.error('Error launching telegram bot', x);
    }
};
