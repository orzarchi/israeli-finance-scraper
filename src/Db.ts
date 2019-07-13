import admin, { ServiceAccount } from 'firebase-admin';
import serviceAccount from '../firebase-service-account.json';
import { IPersistedConfiguration, PersistedTransaction } from './types';
import { Configuration } from './Configuration';
import _ from 'lodash';
import { CollectionReference } from '@google-cloud/firestore';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import logger from "./logger";

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount)
});

export default class Db {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    async addTransactions(transactions: PersistedTransaction[], overwriteIds: boolean = false) {
        if (!transactions.length) {
            return 0;
        }

        logger.log(`Persisting ${transactions.length} transactions`);

        const batch = this.db.batch();
        const collection = this.db.collection('transactions');
        let newTransactions = transactions;

        if (!overwriteIds) {
            newTransactions = await this.removeExistingTransactions(transactions, collection);
        }

        newTransactions.forEach(x => {
            batch.set(collection.doc(this.getUniqueDbId(x)), x);
        });

        await batch.commit();
        logger.log(`Finished persisting ${newTransactions.length} new transactions`);

        return newTransactions.length;
    }

    private async removeExistingTransactions(transactions: PersistedTransaction[], collection: CollectionReference) {
        const existingDocuments = await this.db.getAll(
            ...transactions.map(x => collection.doc(this.getUniqueDbId(x)), { fieldMask: ['id'] })
        );

        const existingTransactions = existingDocuments.filter(x => !!x.data()).map(this.mapDocument);

        const newTransactions = _.differenceBy(transactions, existingTransactions, (x: PersistedTransaction) =>
            this.getUniqueDbId(x)
        );
        return newTransactions;
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

    async getTransactions(startDate: Date, endDate?: Date): Promise<PersistedTransaction[]> {
        const collection = this.db.collection('transactions');
        let query = collection.orderBy('date').where('date', '>=', startDate);

        if (endDate) {
            query = query.where('date', '<=', endDate);
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
