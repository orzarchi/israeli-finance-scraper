import Db from '../Db';
import { uploadTransactions } from '../ynab';
import { PersistedTransaction } from '../types';
import _ from 'lodash';
import { configuration } from '../env';

async function uploadToYnab() {
    const db = new Db();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const transactions = await db.getTransactions(startDate);
    const accountBatches = _.groupBy(transactions, (tx: PersistedTransaction) => {
        let ynabUploadTarget = configuration.getYnabUploadTarget(tx.account);
        return ynabUploadTarget && [ynabUploadTarget.budgetId, ynabUploadTarget.accountId];
    });
    for (const ynabConfiguration in accountBatches) {
        if (!ynabConfiguration) {
            continue;
        }

        const configParts = ynabConfiguration.split(',');
        await uploadTransactions(configParts[0], configParts[1], accountBatches[ynabConfiguration]);
    }
}

uploadToYnab().catch(err => console.error(err));
