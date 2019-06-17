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
import _ from 'lodash';

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

    public toJson() {
        return JSON.parse(JSON.stringify(this));
    }

    public getYnabUploadTarget(transaction: PersistedTransaction): YnabUploadTarget | null {
        const accountConfiguration = _.flatMap(this.accountsConfig, x => x.accounts).find(
            x => x.accountName === transaction.account
        );
        if (!accountConfiguration) {
            return null;
        }

        const ynabBudget = this.ynabBudgets.find(x => x.id === accountConfiguration.ynabTargetBudgetId)!;
        const ynabAccount = ynabBudget.accounts.find(x => x.id === accountConfiguration.ynabTargetAccountId)!;
        return {
            budgetId: ynabBudget.id,
            accountId: ynabAccount.id,
            transferId: this.getCreditAccountTransferId(transaction, accountConfiguration, ynabBudget.accounts)
        };
    }

    private getCreditAccountTransferId(
        transaction: PersistedTransaction,
        finanacialAccountYnabMapping: FinancialAccountYnabMapping,
        ynabAccounts: YnabAccount[]
    ) {
        if (!finanacialAccountYnabMapping.payingYnabAccountId) {
            return;
        }

        const matchingDescription = this.creditCardPaymentDescriptions.find(
            x => x.description === transaction.description
        );
        if (!matchingDescription) {
            return;
        }
        const payingYnabAccount = ynabAccounts.find(x => x.id === finanacialAccountYnabMapping.payingYnabAccountId);

        if (!payingYnabAccount) {
            return;
        }

        return payingYnabAccount.transferAccountId;
    }
}
