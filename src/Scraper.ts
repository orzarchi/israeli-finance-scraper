import { CompanyTypes, createScraper } from 'israeli-bank-scrapers-core';
import { Account, FinanciaAccountConfiguration, PersistedTransaction } from './types';
import _ from 'lodash';
import puppeteer from 'puppeteer-core';
import shortid from 'shortid';
import logger from './logger';
import env from './env';
import { ScaperScrapingResult } from 'israeli-bank-scrapers-core/lib/scrapers/base-scraper';
import { Transaction, TransactionsAccount } from 'israeli-bank-scrapers-core/lib/transactions';
import moment from 'moment-timezone';

export default class Scraper {
    constructor(private userId: string) {
    }

    private removeNonAscii(str: string) {
        return str.replace(/[^\x20-\x7E]+/g, '').trim();
    }

    private mapAccount(account: TransactionsAccount, providerName: CompanyTypes) {
        return account.txns.map(tx => this.mapTransaction(tx, account, providerName));
    }

    private mapTransaction(tx: Transaction, account: Account, providerName: CompanyTypes) {
        // Assume serialized UTC date strings
        const date = moment(tx.date).toDate();
        const processedDate = moment(tx.processedDate).toDate();
        if (tx.chargedAmount && moment(date).hours() > 0) {
            logger.warn(`${providerName} tx date has hour - possible incorrect utc handling`);
        }

        return {
            id: shortid.generate(),
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

    private mapScrape(scrape: ScaperScrapingResult, providerName: CompanyTypes): PersistedTransaction[] {
        return _.flatten((scrape.accounts || []).map(x => this.mapAccount(x, providerName)));
    }

    private processResults(results: { [x: string]: ScaperScrapingResult }): PersistedTransaction[] {
        return _.flatten(
            Object.keys(results).map(providerName => {
                const scrape = results[providerName];
                return this.mapScrape(scrape, providerName as CompanyTypes);
            })
        );
    }

    async runScrape(startDate: Date, ...scrapers: FinanciaAccountConfiguration[]) {
        const results: { [x: string]: ScaperScrapingResult } = {};
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: env.HEADLESS,
            channel: env.PUPPETEER_CHANNEL
        });

        for (const scraperConfig of scrapers) {
            logger.log(`Scraping ${scraperConfig.companyId}`);

            const scraper = createScraper({
                companyId: scraperConfig.companyId,
                startDate,
                combineInstallments: false,
                showBrowser: true,
                verbose: false,
                futureMonthsToScrape: 2,
                browser
            });

            const ScaperScrapingResult = (await scraper.scrape(scraperConfig.credentials));

            if (ScaperScrapingResult.success) {
                ScaperScrapingResult.accounts && ScaperScrapingResult.accounts.forEach(account => {
                    logger.log(`found ${account.txns.length} transactions for account number ${account.accountNumber}`);
                });

                results[scraperConfig.companyId] = ScaperScrapingResult;
            } else {
                logger.log(`failed to scrape ${scraperConfig.companyId} account(s) ${scraperConfig.accounts.map(x => x.accountName).join(', ')}- ${ScaperScrapingResult.errorMessage || ScaperScrapingResult.errorType}`);
            }
        }

        return this.processResults(results);
    }
}
