import { run } from '../scrapers';
import Db from '../Db';
import moment from 'moment';
import env from "../env";

export async function scrape() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();

    for (const configuration of configurations) {
        console.log(`Scraping configuration ${configuration.id}`);
        for (const scraper of configuration.accountsConfig) {
            if (env.ONLY_PROVIDERS.length && !env.ONLY_PROVIDERS.includes(scraper.companyId)){
                continue;
            }
            if (env.ONLY_ACCOUNTS.length && !env.ONLY_ACCOUNTS.some(x=>scraper.accounts.includes(x))){
                continue;
            }

            const results = await run(startDate, scraper);
            await db.addTranscations(results);
        }
    }

    console.log(`Finished scraping everything :)`);
}

