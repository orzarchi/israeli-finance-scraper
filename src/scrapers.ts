import { createScraper } from "israeli-bank-scrapers";
import puppeteer from "puppeteer";
import {ScraperConfig, ScrapeResult} from "./types";

export async function run(startDate:Date,scrapers:ScraperConfig[]) {
    const results: {[x:string]: ScrapeResult} = {};
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

        const scrapeResult = await scraper.scrape(scraperConfig.credentials) as ScrapeResult;

        if (scrapeResult.success) {
            scrapeResult.accounts.forEach((account) => {
                console.log(`found ${account.txns.length} transactions for account number ${account.accountNumber}`);
            });

            results[scraperConfig.companyId] = scrapeResult;
        } else {
            console.error(`scraping failed for the following reason: ${scrapeResult.errorType}`);
        }
    }

    return results;
}

