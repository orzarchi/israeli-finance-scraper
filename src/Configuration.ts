import {
    FinanciaAccountConfiguration,
    FinancialAccountYnabMapping,
    IPersistedConfiguration,
    PersistedTransaction,
    YnabAccount,
    YnabBudget,
    YnabUploadTarget
} from './types';
import _ from 'lodash';
import { CompanyTypes } from 'israeli-bank-scrapers';

export class Configuration implements IPersistedConfiguration {
    public id: string;
    public ynabApiKey?: string;
    public ynabBudgets: YnabBudget[];
    public accountsConfig: FinanciaAccountConfiguration[];
    public persistenceId: string;
    private creditCardPaymentDescriptions: Array<{ provider: CompanyTypes; description: string }> = [
        { provider: CompanyTypes.leumiCard, description: 'מקס-לאומיקאר-י' },
        { provider: CompanyTypes.leumiCard, description: 'מקס איט פיננ-י' },
        { provider: CompanyTypes.leumiCard, description: 'מקס איט פיננסי' },
        { provider: CompanyTypes.visaCal, description: 'כרטיסי אשראי ל' },
        { provider: CompanyTypes.amex, description: 'אמריקן אקספר-י' },
        { provider: CompanyTypes.isracard, description: 'ישראכרט-י' }
    ];

    constructor(persistenceId: string, dto: IPersistedConfiguration) {
        this.id = dto.id;
        this.persistenceId = persistenceId;
        this.ynabApiKey = dto.ynabApiKey;
        this.ynabBudgets = dto.ynabBudgets || [];
        this.accountsConfig = dto.accountsConfig;
    }

    public get hasYnabIntegration(){
        return !!this.ynabApiKey && !!this.ynabBudgets && this.ynabBudgets.length > 0;
    }

    private removeNonAscii(str: string) {
        return str.replace(/[^\x20-\x7E]+/g, '').trim();
    }

    public toJson() {
        return JSON.parse(JSON.stringify(this));
    }

    public getYnabUploadTarget(transaction: PersistedTransaction): YnabUploadTarget | null {
        const accountConfiguration = _.flatMap(this.accountsConfig, x => x.accounts||[]).find(
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
            transferId: this.getCreditAccountTransferId(transaction, accountConfiguration, ynabBudget.accounts)
        };
    }

    private getCreditAccountTransferId(
        transaction: PersistedTransaction,
        finanacialAccountYnabMapping: FinancialAccountYnabMapping,
        ynabAccounts: YnabAccount[]
    ) {
        const matchingDescription = this.creditCardPaymentDescriptions.find(
            x => x.description === transaction.description
        );
        if (!matchingDescription) {
            return;
        }

        const payeeFinancialAccount = _.flatMap(
            this.accountsConfig.filter(x => x.companyId === matchingDescription.provider),
            x => x.accounts
        ).find(x => x.payingYnabAccountId === finanacialAccountYnabMapping.ynabTargetAccountId);
        if (!payeeFinancialAccount) {
            return;
        }

        const payeeYnabAccount = ynabAccounts.find(x => x.id === payeeFinancialAccount.ynabTargetAccountId);

        if (!payeeYnabAccount) {
            return;
        }

        return payeeYnabAccount.transferAccountId;
    }
}
