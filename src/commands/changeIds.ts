import Db from '../Db';
import env from '../env';
import shortid from 'shortid';
import moment from 'moment';

export const changeIds = async function() {
    const db = new Db();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();

    const transactions = await db.getTransactions(startDate);
    transactions.forEach(x => {
        x.id = shortid.generate();
    });

    return db.addTransactions(transactions, true);
};
