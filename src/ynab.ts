import { api as YNABApi, SaveTransaction, TransactionDetail, TransactionSummary } from 'ynab';
import { PersistedTransaction } from './types';
import ClearedEnum = TransactionSummary.ClearedEnum;
import { configuration } from './env';
import _ from 'lodash';
import {readCsv, writeCsv} from "./files";

function createYnabTransaction(accountId: string, transaction: PersistedTransaction): SaveTransaction {
    return {
        account_id: accountId,
        amount: Math.round(transaction.chargedAmount * 1000),
        approved: false,
        cleared: ClearedEnum.Cleared,
        date: new Date(transaction.date).toISOString(),
        import_id: transaction.id,
        memo: `${transaction.provider}-${transaction.account}`,
        payee_name: transaction.description
    };
}

export async function uploadTransactions(budgetId: string, accountId: string, transactions: PersistedTransaction[]) {
    const ynabAPI = new YNABApi(configuration.ynabApiKey);

    console.log(`Uploading ${transactions.length} transactions to budget ${budgetId}`);

    const response = await ynabAPI.transactions.bulkCreateTransactions(budgetId, {
        transactions: transactions.map(x => createYnabTransaction(accountId, x))
    });
    let uploadedTransactionIds = response.data.bulk.transaction_ids;
    let duplicateImportIds = response.data.bulk.duplicate_import_ids;
    console.log(
        `Uploaded ${uploadedTransactionIds.length} transactions, of them ${uploadedTransactionIds.length -
            duplicateImportIds.length} are new`
    );
}

export async function updateTransactions(budgetId: string, transactions: TransactionDetail[]) {
    const ynabAPI = new YNABApi(configuration.ynabApiKey);
    return ynabAPI.transactions.updateTransactions(budgetId, { transactions });
}

export async function getUncategorizedTransactions(budgetId: string) {
    const ynabAPI = new YNABApi(configuration.ynabApiKey);
    const transactions = await ynabAPI.transactions.getTransactions(budgetId, undefined, 'uncategorized');
    return transactions.data.transactions;
}

export async function getYnabCategoryIdLookup(budgetId: string): Promise<Array<{ name: string; id: string }>> {
    try{
        const categories = await readCsv('./categories.csv');
        return categories.map(x=>({id:x[0],name:x[1]}));
    }
    catch(err){

    }

    const ynabAPI = new YNABApi(configuration.ynabApiKey);
    const categoryGroups = await ynabAPI.categories.getCategories(budgetId);
    const categories = _.flatMap(categoryGroups.data.category_groups, x => x.categories);
    try{
        await writeCsv('./categories.csv',categories.map(x=>[x.id,x.name]));
    }
    catch{

    }
    return categories;
}
