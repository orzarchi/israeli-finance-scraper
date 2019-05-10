import {run} from "./scrapers";
import Db from "./Db";
import {processResults} from "./process";
import {scrapers} from "./env";

async function main() {
  const db = new Db();
  const startDate = new Date(2019, 2, 1);
  // startDate.setMonth(startDate.getMonth() - 1);
  const results = await run(startDate, scrapers);
  await db.addTranscations(processResults(results));
}

main().catch(err => console.error(err));
