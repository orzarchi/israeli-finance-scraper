import Telegraf, { ContextMessageUpdate } from 'telegraf';
import Db from '../Db';
import { RedirectLog } from './RedirectLog';
import logger from '../logger';
import { scrape } from '../commands/scrape';
import { uploadToYnab } from '../commands/uploadToYnab';
import moment from 'moment';
import {Message} from "telegraf/typings/telegram-types";

export default class TelegramBot {
    private bot: Telegraf<ContextMessageUpdate>;

    constructor(botToken: string) {
        this.bot = new Telegraf(botToken);
    }

    async launchBot(hostname: string, port: number) {
        this.bot.command('tx', ({ reply, message }) => {
            return this.getTransactions(async (x: string) => {
                await reply(x);
            }, parseInt(this._getArg(message)));
        });

        this.bot.command('scrape', ({ reply }) => {
            return this.scrape(async x => {
                await reply(x);
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
            await scrape();
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
