import env from '../env';
import TelegramBot from '../notifications/TelegramBot';
import logger from '../logger';
import { fastify } from 'fastify';

export async function startWeb() {
    if (!env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN env var not set!');
    }

    if (!env.CHAT_ID) {
        throw new Error('CHAT_ID env var not set!');
    }

    const bot = new TelegramBot(env.BOT_TOKEN);

    const app = fastify({ logger: true });
    let running = false;

    app.get('/', async (req, reply) => {
        return { isActive: running };
    });

    app.post('/', async (req, reply) => {
        if (running) {
            return { success: false };
        }

        running = true;
        bot.scrape(async x => {
            await bot.sendMessage(env.CHAT_ID!, x);
        }).catch(() => {
        }).then(() => {
            running = false;
        });


        return { success: true };
    });

    try {
        logger.info(`Starting scraping webserver on port ${env.WEBSERVER_PORT}`);
        await app.listen({ port: env.WEBSERVER_PORT, host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
