export type ScrapedTransaction = {
    type: 'normal' | 'installments'; // can be either 'normal' or 'installments'
    identifier: number; // only if exists
    date: string; // ISO date string
    processedDate: string; // ISO date string
    originalAmount: number;
    originalCurrency: string;
    chargedAmount: number;
    description: string;
    memo: string; // can be null or empty
    installments: {
        number: number; // the current installment number
        total: number; // the total number of installments
    };
    status: 'completed' | 'pending';
};

export type Account = {
    accountNumber: string;
    txns: ScrapedTransaction[];
};
export type ScrapeResult = {
    success: boolean;
    accounts: Account[];
    errorType: 'invalidPassword' | 'changePassword' | 'timeout' | 'generic'; // only on success=false
    errorMessage: string; // only on success=false
};

export type Provider =
    | 'hapoalim'
    | 'leumi'
    | 'discount'
    | 'otsarHahayal'
    | 'visaCal'
    | 'leumiCard'
    | 'isracard'
    | 'amex';

export type PersistedTransaction = {
    id: string;
    approvalNumber: number;
    provider: Provider;
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
};

export interface IPersistedConfiguration {
    id: string;
    ynabApiKey: string;
    ynabBudgets: YnabBudget[];
    accountsConfig: FinanciaAccountConfiguration[];
}

export type FinancialAccountYnabMapping = {
    accountName: string;
    ynabTargetBudgetId: string;
    ynabTargetAccountId: string;
    payingYnabAccountId?: string;
};

export type FinanciaAccountConfiguration = {
    id: string;
    accounts: Array<FinancialAccountYnabMapping>;
    companyId: Provider;
    credentials: {
        username: string;
        password: string;
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
