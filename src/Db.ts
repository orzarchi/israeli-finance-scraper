import admin from 'firebase-admin';
import { IPersistedConfiguration, PersistedTransaction, ScrapedTransaction, TransactionUpdate } from './types';
import { Configuration } from './Configuration';
import _ from 'lodash';
import { CollectionReference } from '@google-cloud/firestore';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import logger from './logger';
import moment from 'moment-timezone';
import { CompanyTypes } from 'israeli-bank-scrapers-core';

admin.initializeApp();

const BATCH_SIZE = 25;

export default class Db {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    private getCollection() {
        return this.db.collection('transactions');
    }

    async deleteScrapeBatch(scrapeId: string) {
        const collection = this.getCollection();
        const query = collection.where('scrapeId', '==', scrapeId);
        const results = await query.get();
        const batch = this.db.batch();
        results.forEach(x => {
            batch.delete(x.ref);
        });

        await batch.commit();
    }

    async updateById(transactionUpdates: Array<TransactionUpdate>): Promise<void> {
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

    async addTransactions(transactions: ScrapedTransaction[], ignoreExistingTransactions: boolean = false) {
        if (!transactions.length) {
            return 0;
        }

        logger.log(`Persisting ${transactions.length} transactions`);

        const collection = this.getCollection();
        const uniqueIds = this.getUniqueIdsForBatch(transactions);

        let newTransactions = transactions;
        let newTransactionsCount = 0;
        if (!ignoreExistingTransactions) {
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

    async deleteTransactions(transactionIds: string[]) {
        const uniqueIds = await this.getCollection()
            .where('id', 'in', transactionIds)
            .get();
        for (const chunk of _.chunk(uniqueIds.docs, BATCH_SIZE)) {
            await Promise.all(chunk.map(x => x.ref.delete()));
        }
    }

    private getUniqueIdsForBatch(transactions: ScrapedTransaction[]) {
        const seenAlready = new Set();
        return transactions.map(x => {
            const uniqueDbId = this.getUniqueDbId(x);
            let uniqueDbIdWithPostfix = uniqueDbId;
            let index = 2;
            while (seenAlready.has(uniqueDbIdWithPostfix)) {
                uniqueDbIdWithPostfix = `${uniqueDbId}-${index}`;
                index += 1;
            }

            seenAlready.add(uniqueDbIdWithPostfix);
            return uniqueDbIdWithPostfix;
        });
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
                    return [x.id, tx];
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
            // short id
            if (key === 'id') {
                return objValue;
            }
        };

        return _.mergeWith(object, source, customizer);
    }

    private getUniqueDbId(transaction: ScrapedTransaction) {
        const date = transaction.date;

        // New new way of generating unique id - using the existing one from provider + date for repeating transactions
        if (transaction.date >= new Date(2025, 1, 14) && transaction.id) {
            return `${transaction.provider}-${transaction.account}-${moment(transaction.date).format('YYYY-MM-DD')}-${
                transaction.id
            }`;
        }

        // New way of generating unique id - using the existing one from provider
        if (transaction.date > new Date(2024, 11, 1) && transaction.id) {
            return `${transaction.provider}-${transaction.account}-${transaction.id}`;
        }



        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = moment(date).format('DD');
        const dateString = `${date.getFullYear()}-${month}-${day}`;
        let formattedInstallments = transaction.installments ? `${transaction.installments.number}/${transaction.installments.total}` : null;
        let uniqueId = `${transaction.provider}-${transaction.account}-${dateString}-${transaction.description.slice(
            0,
            4
        )}-${transaction.chargedAmount}${formattedInstallments ? '-' + formattedInstallments : ''}`;
        return uniqueId.replace(/[ /]/g, '');
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

        // Ignore pending
        query = query.where('status', '==', 'completed');

        const result = await query.get();
        return result.docs.map(x => this.mapDocument(x));
    }

    mapDocument(document: DocumentSnapshot) {
        const data = document.data()!;
        return { ...data, date: data.date.toDate(), docId: document.id } as PersistedTransaction;
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
}
