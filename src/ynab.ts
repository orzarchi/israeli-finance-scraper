import { ynabApiKey } from './env';
import { api as YNABApi,SaveTransaction, TransactionSummary } from 'ynab';
import { PersistedTransaction } from './types';
import ClearedEnum = TransactionSummary.ClearedEnum;


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
    const ynabAPI = new YNABApi(ynabApiKey);

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
