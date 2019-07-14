import Db from '../Db';
import { uploadTransactions } from '../ynab';
import { PersistedTransaction } from '../types';
import _ from 'lodash';
import env from '../env';
import moment from 'moment';

export const uploadToYnab = async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();

    const todayDate = moment().toDate();
    const transactions = await db.getTransactions(startDate, todayDate);

    for (const configuration of configurations) {
        let relevantTransactions = transactions.filter(tx => configuration.hasYnabUploadTarget(tx));

        const accountBatches = _.groupBy(relevantTransactions, (tx: PersistedTransaction) => {
            let ynabUploadTarget = configuration.getYnabUploadTarget(tx, transactions);
            return (
                ynabUploadTarget && [ynabUploadTarget.budgetId, ynabUploadTarget.accountId, ynabUploadTarget.transferId]
            );
        });
        for (const ynabConfiguration in accountBatches) {
            if (!ynabConfiguration) {
                continue;
            }

            const newTransactions = accountBatches[ynabConfiguration];
            const configParts = ynabConfiguration.split(',');
            await uploadTransactions(
                configuration.ynabApiKey,
                configParts[0],
                configParts[1],
                newTransactions,
                configParts[2]
            );
        }
    }
};
