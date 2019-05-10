import Db from '../Db';
import { uploadTransactions } from '../ynab';
import { PersistedTransaction } from '../types';
import _ from 'lodash';

const BUDGET_ID = 'db71bc1e-7085-42f8-b738-e0faa0857c8f';
const ACCOUNT_ID = 'f12f7a93-44d3-4bd2-9a1f-3b76e359d451';
const SHARED_ACCOUNT_ID = 'fa6692c9-f4bf-4189-9118-9cdac9a2d631';
const dontUpload = ['מקס-לאומיקאר-י'];

const uploadMap: { [x: string]: string } = {
    '‎701-21490_32‎': ACCOUNT_ID,
    '0119': SHARED_ACCOUNT_ID,
    '4710': ACCOUNT_ID,
    '1490': SHARED_ACCOUNT_ID
};

async function uploadToYnab() {
    // @ts-ignore
    const db = new Db();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const transactions = await db.getTransactions(startDate);
    // const transactions = require('../../1.json');
    const accountBatches = _.groupBy(transactions.filter(x=>!dontUpload.includes(x.description)), (x: PersistedTransaction) => uploadMap[x.account]);
    for (const accountId in accountBatches) {
        await uploadTransactions(BUDGET_ID, accountId, accountBatches[accountId]);
    }
}

uploadToYnab().catch(err => console.error(err));
