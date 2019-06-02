import { run } from '../scrapers';
import Db from '../Db';
import moment from 'moment';

export async function scrape() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(2, 'months')
        .toDate();

    for (const configuration of configurations) {
        console.log(`Scraping configuration ${configuration.id}`);
        for (const scraper of configuration.accountsConfig) {
            const results = await run(startDate, scraper);
            await db.addTranscations(results);
        }
    }

    console.log(`Finished scraping everything :)`);
}

