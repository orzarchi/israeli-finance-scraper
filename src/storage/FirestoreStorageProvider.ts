import admin from 'firebase-admin';
import { IStorageProvider } from './IStorageProvider';
import { IPersistedConfiguration, PersistedTransaction, ScrapedTransaction, TransactionUpdate } from '../types';
import { Configuration } from '../Configuration';
import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { CollectionReference } from '@google-cloud/firestore';
import { getUniqueIdsForBatch } from './transactionId';
import _ from 'lodash';
import logger from '../logger';

let initialized = false;

function ensureInitialized() {
    if (!initialized) {
        admin.initializeApp();
        initialized = true;
    }
}

export class FirestoreStorageProvider implements IStorageProvider {
    private db: admin.firestore.Firestore;

    constructor() {
        ensureInitialized();
        this.db = admin.firestore();
    }

    private getCollection() {
        return this.db.collection('transactions');
    }

    async addTransactions(transactions: ScrapedTransaction[], ignoreExisting: boolean = false): Promise<number> {
        if (!transactions.length) {
            return 0;
        }

        logger.log(`Persisting ${transactions.length} transactions`);

        const collection = this.getCollection();
        const uniqueIds = getUniqueIdsForBatch(transactions);

        let newTransactions = transactions;
        let newTransactionsCount = 0;
        if (!ignoreExisting) {
            const [newTxCount, newTx] = await this.mergeWithExistingTransactions(transactions, collection, uniqueIds);
            newTransactions = newTx;
            newTransactionsCount = newTxCount;
        }

        const promises = _.chunk(_.zip(newTransactions, uniqueIds), 500).map(async chunk => {
            const batch = this.db.batch();

            chunk.forEach(([tx, uniqueId]) => {
                batch.set(collection.doc(uniqueId!), tx!);
            });

            await batch.commit();
        });

        await Promise.all(promises);

        logger.log(
            `Finished persisting transactions. ${newTransactionsCount} new, ${transactions.length -
                newTransactionsCount} updates`
        );

        return newTransactions.length;
    }

    async getTransactions(startDate: Date, endDate?: Date, provider?: CompanyTypes): Promise<PersistedTransaction[]> {
        const collection = this.getCollection();
        let query = collection.orderBy('date').where('date', '>=', startDate);

        if (endDate) {
            query = query.where('date', '<=', endDate);
        }

        if (provider) {
            query = query.where('provider', '==', provider);
        }

        query = query.where('status', '==', 'completed');

        const result = await query.get();
        return result.docs.map(x => this.mapDocument(x));
    }

    async updateById(transactionUpdates: TransactionUpdate[]): Promise<void> {
        if (!transactionUpdates.length) {
            return;
        }

        logger.log(`Updating ${transactionUpdates.length} transactions`);
        const collection = this.getCollection();

        const promises = _.chunk(transactionUpdates, 500).map(async chunk => {
            const batch = this.db.batch();

            chunk.forEach(txUpdate => {
                batch.update(collection.doc(txUpdate.docId), _.omit(txUpdate, 'docId'));
            });

            await batch.commit();
        });

        await Promise.all(promises);
    }

    async deleteTransactions(transactionIds: string[]): Promise<void> {
        const uniqueIds = await this.getCollection()
            .where('id', 'in', transactionIds)
            .get();
        for (const chunk of _.chunk(uniqueIds.docs, 25)) {
            await Promise.all(chunk.map(x => x.ref.delete()));
        }
    }

    async deleteScrapeBatch(scrapeId: string): Promise<void> {
        const collection = this.getCollection();
        const query = collection.where('scrapeId', '==', scrapeId);
        const results = await query.get();
        const batch = this.db.batch();
        results.forEach(x => {
            batch.delete(x.ref);
        });
        await batch.commit();
    }

    async getConfigurations(): Promise<Configuration[]> {
        const collection = this.db.collection('configurations');
        const result = await collection.get();
        return result.docs.map(x => {
            const savedConfiguration = x.data() as IPersistedConfiguration;
            return new Configuration(x.id, savedConfiguration);
        });
    }

    async updateConfiguration(persistenceId: string, configuration: IPersistedConfiguration): Promise<void> {
        const collection = this.db.collection('configurations');
        if (!persistenceId) {
            await collection.add(configuration);
        } else {
            await collection.doc(persistenceId).set(_.omit(configuration, 'persistenceId'));
        }
    }

    private async mergeWithExistingTransactions(
        transactions: ScrapedTransaction[],
        collection: CollectionReference,
        uniqueIds: string[]
    ): Promise<[number, ScrapedTransaction[]]> {
        const existingDocuments = await this.db.getAll(
            ...uniqueIds.map(uniqueId => collection.doc(uniqueId), { fieldMask: ['id'] })
        );

        const existingTransactionsMap = new Map(
            existingDocuments
                .filter(x => !!x.data())
                .map(x => {
                    let tx = this.mapDocument(x);
                    return [x.id, tx] as [string, ScrapedTransaction];
                })
        );

        let newCount = 0;

        const merged = transactions.map((transaction, index) => {
            const existingTransaction = existingTransactionsMap.get(uniqueIds[index]);

            if (!existingTransaction) {
                newCount += 1;
                return transaction;
            }

            return this.mergeTransactions(existingTransaction, transaction);
        });
        return [newCount, merged];
    }

    private mergeTransactions(object: ScrapedTransaction, source: ScrapedTransaction) {
        const customizer = (objValue: any, srcValue: any, key: string) => {
            if (key === 'id') {
                return objValue;
            }
        };

        return _.mergeWith(object, source, customizer);
    }

    private mapDocument(document: admin.firestore.DocumentSnapshot) {
        const data = document.data()!;
        return { ...data, date: data.date.toDate(), docId: document.id } as PersistedTransaction;
    }
}
