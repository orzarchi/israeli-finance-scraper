import { run } from "../scrapers";
import Db from "../Db";
import { accountsConfig } from "../env";
import moment from "moment";

async function scrape() {
  const db = new Db();
  const startDate = moment().startOf('month').subtract(2,'months').toDate();
  for (const scraper of accountsConfig) {
    const results = await run(startDate, scraper);
    await db.addTranscations(results);
  }
}

scrape().catch(err => console.error(err));
