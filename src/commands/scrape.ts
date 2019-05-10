import { run } from "../scrapers";
import Db from "../Db";
import { scrapers } from "../env";

async function scrape() {
  const db = new Db();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  for (const scraper of scrapers) {
    const results = await run(startDate, scraper);
    await db.addTranscations(results);
  }
}

scrape().catch(err => console.error(err));
