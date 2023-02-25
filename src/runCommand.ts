import { scrape } from './commands/scrape';
import { uploadToYnab } from './commands/uploadToYnab';
import { startBot } from './commands/startBot';
import { configure } from './commands/configure';
import moment from 'moment-timezone';
import { startWeb } from './commands/startWeb';
import { getOtpContext } from './commands/getOtpContext';

const commandName = process.argv[2];
let command;

moment.tz.setDefault('Asia/Jerusalem');

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
    case 'startWeb':
        command = startWeb;
        break;
    case 'uploadToYnab':
        command = uploadToYnab;
        break;
    case 'configure':
        command = configure;
        break;
    case 'getOtpContext':
        command = getOtpContext;
        break;

    default:
        throw new Error(`Unknown command ${commandName}`);
}

command().catch((x: Error) => console.error(x));
