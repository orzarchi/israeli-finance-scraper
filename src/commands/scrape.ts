import { createStorageProvider } from '../storage';
import moment from 'moment-timezone';
import env from '../env';
import _ from 'lodash';
import shortid from 'shortid';
import logger from '../logger';
import Scraper from '../Scraper';
import { FinanciaAccountConfiguration, ScrapeProviderSummary, ScrapeSummary } from '../types';

function shouldScrapeProvider(scraper: FinanciaAccountConfiguration) {
    if (env.ONLY_PROVIDERS.length && !env.ONLY_PROVIDERS.includes(scraper.companyId)) {
        return false;
    }

    if (env.SKIP_PROVIDERS.length && env.SKIP_PROVIDERS.includes(scraper.companyId)) {
        return false;
    }

    if (
        env.ONLY_ACCOUNTS.length &&
        !_.intersection(env.ONLY_ACCOUNTS, (scraper.accounts || []).map(x => x.accountName)).length
    ) {
        return false;
    }

    return true;
}

export const scrape = async function(): Promise<ScrapeSummary> {
    const db = createStorageProvider();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();
    const startedAt = new Date().toISOString();

    const scrapeId = shortid.generate();
    const scrapeDate = moment().toDate();
    const providers: ScrapeProviderSummary[] = [];
    const totals = {
        providers: 0,
        successfulProviders: 0,
        failedProviders: 0,
        transactionsFound: 0,
        transactionsPersisted: 0,
        filteredOutTransactions: 0,
        newTransactions: 0,
        updatedTransactions: 0,
    };

    for (const configuration of configurations) {
        logger.log(`Scraping configuration ${configuration.id}`);
        for (const scraper of configuration.accountsConfig.filter(x => !x.disabled)) {
            if (!shouldScrapeProvider(scraper)) {
                continue;
            }

            const providerRuns = await new Scraper(configuration.persistenceId).runScrape(startDate, scraper);

            for (const providerRun of providerRuns) {
                providerRun.transactions.forEach(tx => {
                    tx.scrapeId = scrapeId;
                    tx.scrapeDate = scrapeDate;
                });

                const finalTransactions = providerRun.transactions.filter(
                    tx => tx.chargedAmount !== 0 && tx.status !== 'pending'
                );
                const filteredOutTransactions = providerRun.transactions.length - finalTransactions.length;
                const newTransactions = providerRun.success ? await db.addTransactions(finalTransactions) : 0;
                const updatedTransactions = finalTransactions.length - newTransactions;

                providers.push({
                    configurationId: configuration.id,
                    companyId: providerRun.companyId,
                    requestedAccounts: providerRun.requestedAccounts,
                    scrapedAccounts: providerRun.scrapedAccounts,
                    success: providerRun.success,
                    error: providerRun.error,
                    transactionsFound: providerRun.transactions.length,
                    transactionsPersisted: finalTransactions.length,
                    filteredOutTransactions,
                    newTransactions,
                    updatedTransactions,
                });

                totals.providers += 1;
                totals.transactionsFound += providerRun.transactions.length;
                totals.transactionsPersisted += finalTransactions.length;
                totals.filteredOutTransactions += filteredOutTransactions;
                totals.newTransactions += newTransactions;
                totals.updatedTransactions += updatedTransactions;

                if (providerRun.success) {
                    totals.successfulProviders += 1;
                } else {
                    totals.failedProviders += 1;
                }
            }
        }
    }

    logger.log(
        `Finished scraping everything :) ${totals.newTransactions} new transactions scraped, ${totals.updatedTransactions} updates`
    );

    return {
        startedAt,
        finishedAt: new Date().toISOString(),
        totals,
        providers,
    };
};
