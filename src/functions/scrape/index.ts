import * as functions from 'firebase-functions';

import { scrape } from '../../commands/scrape';
import logger from "../../logger";
logger.log('starting function');
export default functions.https.onRequest(async (request, response) => {
    try {
        await scrape();
        response.status(200).send('Scraped!');
    } catch (err) {
        response.status(500).send('Error!');
    }
});
