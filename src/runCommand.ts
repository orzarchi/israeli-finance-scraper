import { scrape } from './commands/scrape';
import { uploadToYnab } from './commands/uploadToYnab';
import { startBot } from './commands/startBot';
import { startBotAndScrape } from './commands/startBotAndScrape';

const commandName = process.argv[2];
let command;
switch (commandName) {
    case 'scrape':
        command = scrape;
        break;
    case 'upload':
        command = uploadToYnab;
        break;
    case 'startBot':
        command = startBot;
        break;
    case 'startBotAndScrape':
        command = startBotAndScrape;
        break;
    case 'uploadToYnab':
        command = uploadToYnab;

    default:
        throw new Error(`Unknown command ${commandName}`);
}

command().catch((x: Error) => console.error(x));
