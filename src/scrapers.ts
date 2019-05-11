import { createScraper } from 'israeli-bank-scrapers';
import puppeteer from 'puppeteer';
import { FinanciaAccountConfiguration, ScrapeResult, Account, PersistedTransaction, Provider } from './types';
import _ from 'lodash';
import shortid from 'shortid';
import moment from 'moment';

function mapTransaction(account: Account, providerName: Provider) {
    return account.txns.map(tx => {
        const dateAsUtc = new Date(moment(tx.date).format('YYYY-MM-DD'));
        return {
            id: shortid.generate(),
            account: account.accountNumber.trim(),
            provider: providerName,
            chargedAmount: tx.chargedAmount,
            date: dateAsUtc,
            description: tx.description,
            installments: tx.installments || null,
            originalAmount: tx.originalAmount,
            originalCurrency: tx.originalCurrency,
            approvalNumber: tx.identifier || 0,
            memo: tx.memo || ''
        };
    });
}

function mapScrape(scrape: ScrapeResult, providerName: Provider): PersistedTransaction[] {
    return _.flatten(scrape.accounts.map(x => mapTransaction(x, providerName)));
}

function processResults(results: { [x: string]: ScrapeResult }): PersistedTransaction[] {
    return _.flatten(
        Object.keys(results).map(providerName => {
            const scrape = results[providerName];
            return mapScrape(scrape, providerName as Provider);
        })
    );
}

export async function run(startDate: Date, ...scrapers: FinanciaAccountConfiguration[]) {
    const results: { [x: string]: ScrapeResult } = {};
    const browser = await puppeteer.launch();
    for (const scraperConfig of scrapers) {
        console.log(`Scraping ${scraperConfig.companyId}`);

        const scraper = createScraper({
            companyId: scraperConfig.companyId, // mandatory; one of 'hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'leumiCard', 'isracard', 'amex'
            startDate,
            combineInstallments: false,
            showBrowser: true,
            verbose: false,
            browser
        });

        const scrapeResult = (await scraper.scrape(scraperConfig.credentials)) as ScrapeResult;

        if (scrapeResult.success) {
            scrapeResult.accounts.forEach(account => {
                console.log(`found ${account.txns.length} transactions for account number ${account.accountNumber}`);
            });

            results[scraperConfig.companyId] = scrapeResult;
        } else {
            console.error(`scraping failed for the following reason: ${scrapeResult.errorType}`);
        }
    }

    return processResults(results);
}
