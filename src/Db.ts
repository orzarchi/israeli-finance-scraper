import admin, { ServiceAccount } from 'firebase-admin';
import serviceAccount from '../firebase-service-account.json';
import { IPersistedConfiguration, PersistedTransaction } from './types';
import { Configuration } from './Configuration';
import _ from 'lodash';
import { CollectionReference } from '@google-cloud/firestore';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount)
});

export default class Db {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    async addTranscations(transactions: PersistedTransaction[], overwriteIds:boolean=false) {
        if (!transactions.length) {
            return;
        }

        console.log(`Persisting ${transactions.length} transactions`);

        const batch = this.db.batch();
        const collection = this.db.collection('transactions');
        let newTransactions = transactions;

        if (!overwriteIds){
            newTransactions = await this.removeExistingTransactions(transactions, collection);
        }

        newTransactions.forEach(x => {
            batch.set(collection.doc(this.getUniqueDbId(x)), x);
        });

        await batch.commit();
        console.log(`Finished persisting ${newTransactions.length} new transactions`);
    }

    private async removeExistingTransactions(transactions: PersistedTransaction[], collection: CollectionReference) {
        const existingDocuments = await this.db.getAll(
            ...transactions.map(x => collection.doc(this.getUniqueDbId(x)), { fieldMask: ['id'] })
        );

        const existingTransactions = _.compact(existingDocuments.map(x => x.data()));

        const newTransactions = _.differenceBy(transactions, existingTransactions, (x: PersistedTransaction) => x.id);
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

    async getTransactions(startDate: Date): Promise<PersistedTransaction[]> {
        const collection = this.db.collection('transactions');
        const result = await collection
            .orderBy('date')
            .where('date', '>=', startDate)
            .get();
        return result.docs.map(x => {
            const data = x.data();
            return { ...data, date: data.date.toDate() } as PersistedTransaction;
        });
    }

    async getConfigurations(): Promise<Configuration[]> {
        const collection = this.db.collection('configurations');
        const result = await collection.get();
        return result.docs.map(x => {
            const savedConfiguration = x.data() as IPersistedConfiguration;
            return new Configuration(savedConfiguration);
        });
    }

    async updateConfiguration(configuration: IPersistedConfiguration): Promise<void> {
        const collection = this.db.collection('configurations');
        await collection.add(configuration);
    }
}
