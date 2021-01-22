import { createScraper } from 'israeli-bank-scrapers';
import {
    Account,
    FinanciaAccountConfiguration,
    PersistedTransaction,
    Provider,
    ScrapeResult,
    ScrapedTransaction
} from './types';
import _ from 'lodash';
import puppeteer from 'puppeteer';
import shortid from 'shortid';
import moment from 'moment';
import logger from './logger';
import env from './env';

export default class Scraper {
    constructor(private userId: string) {}

    private removeNonAscii(str: string) {
        return str.replace(/[^\x20-\x7E]+/g, '').trim();
    }

    private mapAccount(account: Account, providerName: Provider) {
        return account.txns.map(tx => this.mapTransaction(tx, account, providerName));
    }

    private mapTransaction(tx: ScrapedTransaction, account: Account, providerName: Provider) {
        return {
            id: shortid.generate(),
            account: this.removeNonAscii(account.accountNumber),
            provider: providerName,
            chargedAmount: tx.chargedAmount,
            date: new Date(moment(tx.date).format('YYYY-MM-DD')),
            processedDate: new Date(moment(tx.processedDate).format('YYYY-MM-DD')),
            description: tx.description.trim(),
            installments: tx.installments || null,
            originalAmount: tx.originalAmount,
            originalCurrency: tx.originalCurrency,
            approvalNumber: tx.identifier || 0,
            memo: tx.memo || '',
            userId: this.userId,
            status: tx.status
        };
    }

    private mapScrape(scrape: ScrapeResult, providerName: Provider): PersistedTransaction[] {
        return _.flatten(scrape.accounts.map(x => this.mapAccount(x, providerName)));
    }

    private processResults(results: { [x: string]: ScrapeResult }): PersistedTransaction[] {
        return _.flatten(
            Object.keys(results).map(providerName => {
                const scrape = results[providerName];
                return this.mapScrape(scrape, providerName as Provider);
            })
        );
    }

    async runScrape(startDate: Date, ...scrapers: FinanciaAccountConfiguration[]) {
        const results: { [x: string]: ScrapeResult } = {};
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: env.HEADLESS
        });

        for (const scraperConfig of scrapers) {
            logger.log(`Scraping ${scraperConfig.companyId}`);

            const scraper = createScraper({
                companyId: scraperConfig.companyId,
                startDate,
                combineInstallments: false,
                showBrowser: true,
                verbose: false,
                browser
            });

            const scrapeResult = (await scraper.scrape(scraperConfig.credentials)) as ScrapeResult;

            if (scrapeResult.success) {
                scrapeResult.accounts && scrapeResult.accounts.forEach(account => {
                    logger.log(`found ${account.txns.length} transactions for account number ${account.accountNumber}`);
                });

                results[scraperConfig.companyId] = scrapeResult;
            } else {
                logger.log(`failed to scrape ${scraperConfig.companyId} account(s) ${scraperConfig.accounts.map(x => x.accountName).join(', ')}- ${scrapeResult.errorMessage || scrapeResult.errorType}`);
            }
        }

        return this.processResults(results);
    }
}
