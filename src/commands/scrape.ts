import { runScrape } from '../scrapers';
import Db from '../Db';
import moment from 'moment';
import env from '../env';
import _ from 'lodash';
import shortid = require('shortid');
import {tryDebuggingLocally} from "../debug";

export const scrape = tryDebuggingLocally(async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();

    const scrapeId = shortid.generate();
    const scrapeDate = new Date();

    let total = 0;

    for (const configuration of configurations) {
        console.log(`Scraping configuration ${configuration.id}`);
        for (const scraper of configuration.accountsConfig) {
            if (env.ONLY_PROVIDERS.length && !env.ONLY_PROVIDERS.includes(scraper.companyId)) {
                continue;
            }
            if (env.ONLY_ACCOUNTS.length && !_.intersection(env.ONLY_ACCOUNTS,scraper.accounts.map(x=>x.accountName)).length) {
                continue;
            }

            const results = await runScrape(startDate, scraper);
            results.forEach(x => {
                x.scrapeId = scrapeId;
                x.scrapeDate = scrapeDate;
            });
            total += results.length;
            await db.addTransactions(results);
        }
    }

    console.log(`Finished scraping everything :) ${total} scraped`);
});
