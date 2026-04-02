import { IStorageProvider } from './IStorageProvider';
import { SqliteStorageProvider } from './SqliteStorageProvider';

export function createStorageProvider(): IStorageProvider {
    return new SqliteStorageProvider();
}

export type { IStorageProvider } from './IStorageProvider';
