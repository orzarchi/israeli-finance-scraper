import { CompanyTypes, createScraper } from 'israeli-bank-scrapers-core';
import { Account, FinanciaAccountConfiguration, ScrapedTransaction } from './types';
import _ from 'lodash';
import shortid from 'shortid';
import logger from './logger';
import { ScraperScrapingResult, ScraperCredentials } from 'israeli-bank-scrapers-core';
import { Transaction, TransactionsAccount } from 'israeli-bank-scrapers-core/lib/transactions';
import moment from 'moment-timezone';
import { launchPuppeteer } from './puppeteer';

export default class Scraper {
    constructor(private userId: string) {}

    private removeNonAscii(str: string) {
        return str.replace(/[^\x20-\x7E]+/g, '').trim();
    }

    private mapAccount(account: TransactionsAccount, providerName: CompanyTypes) {
        return account.txns.map(tx => this.mapTransaction(tx, account, providerName));
    }

    private mapTransaction(tx: Transaction, account: Account, providerName: CompanyTypes) {
        // Assume serialized IL date strings
        const date = moment.tz(tx.date, 'YYYY-MM-DDTHH:mm:ss', 'Asia/Jerusalem').toDate();
        const processedDate = moment.tz(tx.processedDate, 'YYYY-MM-DDTHH:mm:ss', 'Asia/Jerusalem').toDate();

        return {
            id: tx.identifier?.toString() || shortid.generate(),
            account: this.removeNonAscii(account.accountNumber),
            provider: providerName,
            chargedAmount: tx.chargedAmount,
            date,
            processedDate,
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

    private mapScrape(scrape: ScraperScrapingResult, providerName: CompanyTypes): ScrapedTransaction[] {
        return _.flatten((scrape.accounts || []).map(x => this.mapAccount(x, providerName)));
    }

    private processResults(results: { [x: string]: ScraperScrapingResult }): ScrapedTransaction[] {
        return _.flatten(
            Object.keys(results).map(providerName => {
                const scrape = results[providerName];
                return this.mapScrape(scrape, providerName as CompanyTypes);
            })
        );
    }

    async runScrape(startDate: Date, ...scrapers: FinanciaAccountConfiguration[]) {
        const results: { [x: string]: ScraperScrapingResult } = {};
        const browser = await launchPuppeteer();

        for (const scraperConfig of scrapers) {
            logger.log(`Scraping ${scraperConfig.companyId}`);

            const scraper = createScraper({
                companyId: scraperConfig.companyId,
                startDate,
                combineInstallments: false,
                showBrowser: true,
                verbose: false,
                futureMonthsToScrape: 3,
                browser
            });

            const scraperScrapingResult = await scraper.scrape(scraperConfig.credentials as ScraperCredentials);

            if (scraperScrapingResult.success) {
                scraperScrapingResult.accounts &&
                    scraperScrapingResult.accounts.forEach(account => {
                        logger.log(
                            `found ${account.txns.length} transactions for account number ${account.accountNumber}`
                        );
                    });

                results[scraperConfig.companyId] = scraperScrapingResult;
            } else {
                logger.log(
                    `failed to scrape ${scraperConfig.companyId} account(s) ${scraperConfig.accounts
                        .map(x => x.accountName)
                        .join(', ')}- ${scraperScrapingResult.errorMessage || scraperScrapingResult.errorType}`
                );
            }
        }

        return this.processResults(results);
    }
}
