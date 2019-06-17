import { api as YNABApi, SaveTransaction, TransactionDetail, TransactionSummary } from 'ynab';
import { PersistedTransaction } from './types';
import ClearedEnum = TransactionSummary.ClearedEnum;
import _ from 'lodash';
import { readCsv, writeCsv } from './files';

function createYnabTransaction(
    accountId: string,
    transaction: PersistedTransaction,
    payeeId?: string | null
): SaveTransaction {
    return {
        account_id: accountId,
        amount: Math.round(transaction.chargedAmount * 1000),
        approved: false,
        cleared: ClearedEnum.Cleared,
        date: new Date(transaction.date).toISOString(),
        import_id: transaction.id,
        memo: `${transaction.provider}-${transaction.account}${transaction.memo ? ' ' + transaction.memo : ''}`,
        payee_name: !payeeId ? transaction.description : undefined,
        payee_id: payeeId ? payeeId : undefined
    };
}

export async function uploadTransactions(
    ynabApiKey: string,
    budgetId: string,
    accountId: string,
    transactions: PersistedTransaction[],
    transferAccountId?: string | null
) {

    const transferAccountLogString = transferAccountId ? ` (Transferring to account ${transferAccountId})` : '';
    console.log(`Uploading ${transactions.length} transactions to budget ${budgetId}${transferAccountLogString}`);

    const ynabAPI = new YNABApi(ynabApiKey);


    const ynabTransactions = transactions.map(x => createYnabTransaction(accountId, x, transferAccountId));
    const response = await ynabAPI.transactions.createTransactions(budgetId, {
        transactions: ynabTransactions
    });
    let uploadedTransactionIds = response.data.transaction_ids;
    console.log(`Uploaded ${uploadedTransactionIds.length} new transactions`);
}

export async function updateTransactions(ynabApiKey: string, budgetId: string, transactions: TransactionDetail[]) {
    const ynabAPI = new YNABApi(ynabApiKey);
    return ynabAPI.transactions.updateTransactions(budgetId, { transactions });
}

export async function getUncategorizedTransactions(ynabApiKey: string, budgetId: string) {
    const ynabAPI = new YNABApi(ynabApiKey);
    const transactions = await ynabAPI.transactions.getTransactions(budgetId, undefined, 'uncategorized');
    return transactions.data.transactions;
}

export async function getYnabCategoryIdLookup(
    ynabApiKey: string,
    budgetId: string
): Promise<Array<{ name: string; id: string }>> {
    try {
        const categories = await readCsv('./categories.csv');
        return categories.map(x => ({ id: x[0], name: x[1] }));
    } catch (err) {}

    const ynabAPI = new YNABApi(ynabApiKey);
    const categoryGroups = await ynabAPI.categories.getCategories(budgetId);
    const categories = _.flatMap(categoryGroups.data.category_groups, x => x.categories);
    try {
        await writeCsv('./categories.csv', categories.map(x => [x.id, x.name]));
    } catch {}
    return categories;
}

export async function getAccounts(ynabApiKey: string, budgetId: string) {
    const ynabAPI = new YNABApi(ynabApiKey);
    const result = await ynabAPI.accounts.getAccounts(budgetId);
    return result.data.accounts;
}

export async function getBudgets(ynabApiKey: string) {
    const ynabAPI = new YNABApi(ynabApiKey);
    const result = await ynabAPI.budgets.getBudgets();
    return result.data.budgets;
}
