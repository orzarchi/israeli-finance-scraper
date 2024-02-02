import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { Transaction } from 'israeli-bank-scrapers-core/lib/transactions';

export type Account = {
    accountNumber: string;
    txns: Transaction[];
};

export type PersistedTransaction = {
    id: string;
    approvalNumber: number | string;
    provider: CompanyTypes;
    account: string;
    date: Date; // ISO date string
    processedDate: Date; // ISO date string
    originalAmount: number;
    originalCurrency: string;
    chargedAmount: number;
    description: string;
    memo: string; // can be null or empty
    installments: null | {
        number: number; // the current installment number
        total: number; // the total number of installments
    };
    scrapeId?: string;
    scrapeDate?: Date;
    userId: string;
    status: 'completed' | 'pending';
};

export interface IPersistedConfiguration {
    id: string;
    ynabApiKey?: string;
    ynabBudgets?: YnabBudget[];
    accountsConfig: FinanciaAccountConfiguration[];
}

export type FinancialAccountYnabMapping = {
    accountName: string;
    ynabTargetBudgetId?: string;
    ynabTargetAccountId?: string;
    payingYnabAccountId?: string;
};

export type FinanciaAccountConfiguration = {
    id: string;
    disabled?: boolean;
    accounts: Array<FinancialAccountYnabMapping>;
    companyId: CompanyTypes;
    credentials:
        | {
              username: string;
              password: string;
          }
        | { userCode: string; password: string }
        | { id: string; password: string; card6Digits: string }
        | { id: string; password: string; num: string }
        | {
              email: string;
              password: string;
              phoneNumber?: string;
              otpLongTermToken?: string;
          };
};

export type YnabAccount = {
    name: string;
    id: string;
    transferAccountId: string;
};

export type YnabBudget = {
    name: string;
    id: string;
    accounts: YnabAccount[];
};

export type YnabUploadTarget = {
    budgetId: string;
    accountId: string;
    transferId?: string;
};
