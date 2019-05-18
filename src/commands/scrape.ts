import { run } from "../scrapers";
import Db from "../Db";
import { configuration } from "../env";
import moment from "moment";

async function scrape() {
  const db = new Db();
  const startDate = moment().startOf('month').subtract(2,'months').toDate();
  for (const scraper of configuration.accountsConfig) {
    const results = await run(startDate, scraper);
    await db.addTranscations(results);
  }
}

scrape().catch(err => console.error(err));
