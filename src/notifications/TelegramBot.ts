import { Telegraf, Context } from 'telegraf';
import type { Message } from 'node-telegram-bot-api';
import Db from '../Db';
import { RedirectLog } from './RedirectLog';
import logger from '../logger';
import { scrape } from '../commands/scrape';
import { uploadToYnab } from '../commands/uploadToYnab';
import moment from 'moment';

export default class TelegramBot {
    private bot: Telegraf<Context>;

    constructor(botToken: string) {
        this.bot = new Telegraf(botToken);
    }

    async launchBot(hostname: string, port: number) {
        this.bot.command('tx', async (ctx: Context) => {
            return this.getTransactions(async (x: string) => {
                await ctx.reply(x);
            }, parseInt(this._getArg(ctx.message)));
        });

        this.bot.command('scrape', async (ctx: Context) => {
            return this.scrape(async x => {
                await ctx.reply(x);
            });
        });

        // Set telegram webhook
        await this.bot.launch({
            webhook: {
                // @ts-ignore
                domain: hostname,
                tlsOptions: null,
                port: port
            }
        });

        logger.info(`Started telegram bot on ${hostname}:${port}`);
    }

    public sendMessage(chatId: string, message: string) {
        return this.bot!.telegram.sendMessage(chatId, message.slice(0, 4000));
    }

    private _getArg(message?: Message) {
        const messageString = (message && message.text) || '';
        return messageString
            .split(' ')
            .slice(1)
            .join(' ');
    }

    public async scrape(reply: (text: string) => Promise<void>) {
        logger.info('Got scrape command');
        const redirectLog = new RedirectLog(x => {
            console.log(x);
            reply(x);
        });
        logger.info('Starting scraping...');

        try {
            redirectLog.start();
            const scrapedTranscationsNumber = await scrape();
            if (scrapedTranscationsNumber > 0) {
                await uploadToYnab();
            }
            redirectLog.stop();
        } catch (err) {
            redirectLog.stop();
            try {
                logger.error((<Error>err).stack || (<Error>err).message);
                await reply(`Error scraping: ${(<Error>err).stack}`);
            } catch {}
        }
        logger.info('Finished scrape command');
    }

    public async getTransactions(reply: (text: string) => Promise<void>, daysAgo: number) {
        const db = new Db();
        const resolvedDaysAgo = daysAgo || 5;
        const startDate = moment()
            .subtract(resolvedDaysAgo, 'days')
            .startOf('day')
            .toDate();
        logger.info(`Returning transactions ${resolvedDaysAgo} days back`);
        const transactions = await db.getTransactions(startDate);
        const replyString = transactions
            .map(
                x =>
                    `[${moment(x.date).format('DD/MM')}] ${x.description.slice(0, 30)} - ${this.formatCurrency(
                        'ILS'
                    )}${x.chargedAmount * -1}`
            )
            .join('\n');

        return reply(replyString || 'No transactions!');
    }

    private formatCurrency(x: string) {
        switch (x) {
            case 'ILS':
                return '₪';
            case 'USD':
                return '$';
            default:
                return x;
        }
    }
}
