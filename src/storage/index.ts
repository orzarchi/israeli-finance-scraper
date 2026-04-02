import { IStorageProvider } from './IStorageProvider';
import { SqliteStorageProvider } from './SqliteStorageProvider';

export function createStorageProvider(): IStorageProvider {
    const backend = process.env.STORAGE_BACKEND || 'sqlite';

    if (backend === 'firestore') {
        // Lazy require to avoid loading firebase-admin when using SQLite
        const { FirestoreStorageProvider } = require('./FirestoreStorageProvider');
        return new FirestoreStorageProvider();
    }

    return new SqliteStorageProvider();
}

export type { IStorageProvider } from './IStorageProvider';
