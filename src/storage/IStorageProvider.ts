import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { Configuration } from '../Configuration';
import { IPersistedConfiguration, PersistedTransaction, ScrapedTransaction, TransactionUpdate } from '../types';

export interface IStorageProvider {
    addTransactions(transactions: ScrapedTransaction[], ignoreExisting?: boolean): Promise<number>;
    getTransactions(startDate: Date, endDate?: Date, provider?: CompanyTypes): Promise<PersistedTransaction[]>;
    updateById(updates: TransactionUpdate[]): Promise<void>;
    deleteTransactions(ids: string[]): Promise<void>;
    deleteScrapeBatch(scrapeId: string): Promise<void>;
    getConfigurations(): Promise<Configuration[]>;
    updateConfiguration(persistenceId: string, config: IPersistedConfiguration): Promise<void>;
}
