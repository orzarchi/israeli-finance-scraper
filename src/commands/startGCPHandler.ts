import functions from '@google-cloud/functions-framework';
import env from '../env';
import TelegramBot from '../notifications/TelegramBot';

// Register an HTTP function with the Functions Framework
functions.http('finanaceScraper', async (req, res) => {
    if (!env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN env var not set!');
    }

    if (!env.CHAT_ID) {
        throw new Error('CHAT_ID env var not set!');
    }

    const bot = new TelegramBot(env.BOT_TOKEN);

    try {
        await bot.scrape(async x => {
            await bot.sendMessage(env.CHAT_ID!, x);
        });

        res.send('OK');
    } catch (e) {
        res.status(500).send('Error');
    }
});
