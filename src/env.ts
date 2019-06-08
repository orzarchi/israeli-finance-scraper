import {Provider} from "./types";

const parseList = (x?:string) => (x || '').replace(' ','').split(',').filter(y=>!!y);

export default {
    ONLY_PROVIDERS: parseList(process.env['ONLY_PROVIDERS']) as Provider[],
    ONLY_ACCOUNTS: parseList(process.env['ONLY_ACCOUNTS']) as string[],
    MONTHS_TO_SCRAPE: parseInt(process.env['MONTHS_TO_SCRAPE'] || '1')
}
