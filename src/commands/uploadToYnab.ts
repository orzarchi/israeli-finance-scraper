import Db from '../Db';
import {uploadTransactions} from '../ynab';
import {PersistedTransaction} from '../types';
import _ from 'lodash';
import env from '../env';
import moment from 'moment';
import {tryDebuggingLocally} from '../debug';

export const uploadToYnab = tryDebuggingLocally(async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    const startDate = moment()
        .startOf('month')
        .subtract(env.MONTHS_TO_SCRAPE, 'months')
        .toDate();

    let todayDate = moment().toDate();
    const transactions = await db.getTransactions(startDate, todayDate);

    for (const configuration of configurations) {
        const accountBatches = _.groupBy(
            transactions.filter(tx => !!configuration.getYnabUploadTarget(tx)),
            (tx: PersistedTransaction) => {
                let ynabUploadTarget = configuration.getYnabUploadTarget(tx);
                return (
                    ynabUploadTarget && [
                        ynabUploadTarget.budgetId,
                        ynabUploadTarget.accountId,
                        ynabUploadTarget.transferId
                    ]
                );
            }
        );
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
});
