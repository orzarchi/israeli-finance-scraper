import {scrape} from "./commands/scrape";

scrape().catch(err => console.error(err));
