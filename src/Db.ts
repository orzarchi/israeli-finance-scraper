import admin, {ServiceAccount} from "firebase-admin";
import serviceAccount from "../firebase-service-account.json";
import {PersistedTransaction} from "./types";

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount)
});

export default class Db {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = admin.firestore();
    }

    async addTranscations(transactions: PersistedTransaction[]) {
        console.log(`Persisting ${transactions.length} transactions`);
        const batch = this.db.batch();
        const collection = this.db.collection("transactions");
        transactions.forEach(x => {
            batch.set(collection.doc(this.getUniqueDbId(x)), x);
        });

        await batch.commit();
        console.log("Finished persisting");
    }

    private getUniqueDbId(transaction: PersistedTransaction) {
        const date = transaction.date;
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const dateString = `${date.getFullYear()}-${month}-${day}`;
        return `${transaction.provider}-${transaction.account}-${dateString}-${transaction.description.slice(0, 4)}-${transaction.chargedAmount}`;
    }

    async getTransactions(startDate: Date):Promise<PersistedTransaction[]> {
        const collection = this.db.collection("transactions");
        const result = await collection.orderBy('date').where('date', '>=', startDate).get();
        return result.docs.map(x => {
            const data = x.data();
            return {...data, date:data.date.toDate()} as PersistedTransaction;
        });
    }
}
