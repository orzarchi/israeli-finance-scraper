import admin, { ServiceAccount } from 'firebase-admin';
import serviceAccount from '../firebase-service-account.json';
import { IPersistedConfiguration, PersistedTransaction } from './types';
import { Configuration } from './Configuration';
import _ from 'lodash';
import { CollectionReference } from '@google-cloud/firestore';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import logger from './logger';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount)
});

export default class Db {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    async addTransactions(transactions: PersistedTransaction[], ignoreExistingTransactions: boolean = false) {
        if (!transactions.length) {
            return 0;
        }

        logger.log(`Persisting ${transactions.length} transactions`);

        const collection = this.db.collection('transactions');
        let newTransactions = transactions;
        if (!ignoreExistingTransactions) {
            newTransactions = await this.mergeWithExistingTransactions(transactions, collection);
        }

        const promises = _.chunk(newTransactions, 500).map(async chunk => {
            const batch = this.db.batch();

            chunk.forEach(x => {
                batch.set(collection.doc(this.getUniqueDbId(x)), x);
            });

            await batch.commit();
        });

        await Promise.all(promises);

        logger.log(`Finished persisting ${newTransactions.length} new transactions`);

        return newTransactions.length;
    }

    private async mergeWithExistingTransactions(transactions: PersistedTransaction[], collection: CollectionReference) {
        const existingDocuments = await this.db.getAll(
            ...transactions.map(x => collection.doc(this.getUniqueDbId(x)), { fieldMask: ['id'] })
        );

        const existingTransactionsMap = new Map(
            existingDocuments
                .filter(x => !!x.data())
                .map(x => {
                    let tx = this.mapDocument(x);
                    return [this.getUniqueDbId(tx), tx];
                })
        );

        return transactions.map(transaction => {
            const existingTransaction = existingTransactionsMap.get(this.getUniqueDbId(transaction));

            if (!existingTransaction) {
                return transaction;
            }

            return this.mergeTransactions(existingTransaction, transaction);
        });
    }

    private mergeTransactions(object: PersistedTransaction, source: PersistedTransaction) {
        const customizer = (objValue: any, srcValue: any, key: string) => {
            // short id
            if (key === 'id') {
                return objValue;
            }
        };

        return _.mergeWith(object, source, customizer);
    }

    private getUniqueDbId(transaction: PersistedTransaction) {
        const date = transaction.date;
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date
            .getDate()
            .toString()
            .padStart(2, '0');
        const dateString = `${date.getFullYear()}-${month}-${day}`;
        let uniqueId = `${transaction.provider}-${transaction.account}-${dateString}-${transaction.description.slice(
            0,
            4
        )}-${transaction.chargedAmount}`;
        return uniqueId.replace(/[ /]/g, '');
    }

    async getTransactions(
        startDate: Date,
        endDate?: Date,
        ignorePending: Boolean = true
    ): Promise<PersistedTransaction[]> {
        const collection = this.db.collection('transactions');
        let query = collection.orderBy('date').where('date', '>=', startDate);

        if (endDate) {
            query = query.where('date', '<=', endDate);
        }

        if (ignorePending) {
            query = query.where('status', '==', 'completed');
        }

        const result = await query.get();
        return result.docs.map(x => this.mapDocument(x));
    }

    mapDocument(document: DocumentSnapshot) {
        const data = document.data()!;
        return { ...data, date: data.date.toDate() } as PersistedTransaction;
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
            await collection.doc(persistenceId).set(configuration);
        }
    }
}
