import {
    FinanciaAccountConfiguration,
    FinancialAccountYnabMapping,
    IPersistedConfiguration,
    PersistedTransaction,
    Provider,
    YnabAccount,
    YnabBudget,
    YnabUploadTarget
} from './types';
import _, { Dictionary } from 'lodash';
import moment = require('moment');

export class Configuration implements IPersistedConfiguration {
    public id: string;
    public ynabApiKey: string;
    public ynabBudgets: YnabBudget[];
    public accountsConfig: FinanciaAccountConfiguration[];
    public persistenceId: string;
    private creditCardPaymentDescriptions: Array<{ provider: Provider; description: string }> = [
        { provider: 'leumiCard', description: 'מקס-לאומיקאר-י' }
    ];

    constructor(persistenceId: string, dto: IPersistedConfiguration) {
        this.id = dto.id;
        this.persistenceId = persistenceId;
        this.ynabApiKey = dto.ynabApiKey;
        this.ynabBudgets = dto.ynabBudgets;
        this.accountsConfig = dto.accountsConfig;
    }

    private removeNonAscii(str: string) {
        return str.replace(/[^\x20-\x7E]+/g, '').trim();
    }

    public toJson() {
        return JSON.parse(JSON.stringify(this));
    }

    public hasYnabUploadTarget(transaction: PersistedTransaction): boolean {
        const accountConfiguration = _.flatMap(this.accountsConfig, x => x.accounts).find(
            x => this.removeNonAscii(x.accountName) === this.removeNonAscii(transaction.account)
        );

        return !!accountConfiguration;
    }

    public getYnabUploadTarget(
        transaction: PersistedTransaction,
        transactions: PersistedTransaction[]
    ): YnabUploadTarget | null {
        const accountConfiguration = _.flatMap(this.accountsConfig, x => x.accounts).find(
            x => this.removeNonAscii(x.accountName) === this.removeNonAscii(transaction.account)
        );

        if (!accountConfiguration) {
            return null;
        }

        const ynabBudget = this.ynabBudgets.find(x => x.id === accountConfiguration.ynabTargetBudgetId)!;
        const ynabAccount = ynabBudget.accounts.find(x => x.id === accountConfiguration.ynabTargetAccountId)!;
        return {
            budgetId: ynabBudget.id,
            accountId: ynabAccount.id,
            transferId: this.getCreditAccountTransferId(
                transaction,
                transactions,
                accountConfiguration,
                ynabBudget.accounts
            )
        };
    }

    private getCreditAccountTransferId(
        transaction: PersistedTransaction,
        transactions: PersistedTransaction[],
        finanacialAccountYnabMapping: FinancialAccountYnabMapping,
        ynabAccounts: YnabAccount[]
    ) {
        const matchingDescription = this.creditCardPaymentDescriptions.find(
            x => x.description === transaction.description
        );
        if (!matchingDescription) {
            return;
        }

        // Filter only relevant CC providers which are payed in the same bank as the passed transaction.
        const payeeFinancialAccount = _.flatMap(
            this.accountsConfig.filter(x => x.companyId === matchingDescription.provider),
            x => x.accounts
        )
            .filter(x => x.payingYnabAccountId === finanacialAccountYnabMapping.ynabTargetAccountId)
            .find(account => this.accountNameMatchingChargedAmountToTransactionSum(account, transaction, transactions));

        if (!payeeFinancialAccount) {
            return;
        }

        const payeeYnabAccount = ynabAccounts.find(x => x.id === payeeFinancialAccount.ynabTargetAccountId);

        if (!payeeYnabAccount) {
            return;
        }

        return payeeYnabAccount.transferAccountId;
    }

    private accountNameMatchingChargedAmountToTransactionSum(
        financialAccount: FinancialAccountYnabMapping,
        transaction: PersistedTransaction,
        transactions: PersistedTransaction[]
    ) {
        const relevantTransactions = transactions
            .filter(tx => tx.account === financialAccount.accountName)
            .filter(tx => {
                const start = moment(transaction.date).startOf('month');
                const end = moment(transaction.date).endOf('month');

                return moment(tx.date).isBetween(start, end);
            });

        const transactionArraysMap = _.groupBy(relevantTransactions, (tx: PersistedTransaction) => {
            return `${tx.account},${tx.processedDate}`;
        });

        const transactionSumMap = _.mapValues(transactionArraysMap, (txs: PersistedTransaction[]) => {
            return txs.reduce((sum: number, tx: PersistedTransaction) => sum + tx.chargedAmount, 0);
        });

        const key = _.findKey(transactionSumMap, sum => sum === transaction.chargedAmount);

        if (!key) {
            return false;
        }

        const accountName = key.split(',')[0];

        return financialAccount.accountName === accountName;
    }
}
