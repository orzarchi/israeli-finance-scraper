import yn from 'yn';
import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { ChromeReleaseChannel } from 'puppeteer-core';

const parseList = (x?: string) => (x || '').replace(' ', '').split(',').filter(y => !!y);

export default {
    ONLY_PROVIDERS: parseList(process.env['ONLY_PROVIDERS']) as CompanyTypes[],
    ONLY_ACCOUNTS: parseList(process.env['ONLY_ACCOUNTS']) as string[],
    MONTHS_TO_SCRAPE: parseInt(process.env['MONTHS_TO_SCRAPE'] || '1'),
    BOT_TOKEN: process.env['BOT_TOKEN'],
    CHAT_ID: process.env['CHAT_ID'],
    WEBSERVER_PORT: parseInt(process.env['WEBSERVER_PORT'] || '9000'),
    HEROKU_PORT: parseInt(process.env['PORT'] || '5000'),
    HEROKU_ADDRESS: process.env['HEROKU_ADDRESS'],
    HEADLESS: yn(process.env['HEADLESS'] || true) || false,
    PUPPETEER_CHANNEL: (process.env['PUPPETEER_CHANNEL'] || 'chrome') as ChromeReleaseChannel,
    PUPPETEER_EXECUTABLE_PATH: process.env['PUPPETEER_EXECUTABLE_PATH']
};
