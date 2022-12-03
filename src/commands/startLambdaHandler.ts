import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import env from '../env';
import TelegramBot from '../notifications/TelegramBot';

export const lambdaHandler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
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

        return {
            statusCode: 200,
            isBase64Encoded: true,
            headers: {
                'Content-type': 'image/png'
            },
            body: JSON.stringify({ success: true })
        };

    } catch (e) {
        return {
            statusCode: 500,
            body: ''
        };
    }
};
