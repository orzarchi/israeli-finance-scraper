import { scrape } from './commands/scrape';
import { uploadToYnab } from './commands/uploadToYnab';
import { startBot } from './commands/startBot';
import { startBotAndScrape } from './commands/startBotAndScrape';
import { configure } from './commands/configure';

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
        break;
    case 'configure':
        command = configure;
        break;

    default:
        throw new Error(`Unknown command ${commandName}`);
}

command().catch((x: Error) => console.error(x));
