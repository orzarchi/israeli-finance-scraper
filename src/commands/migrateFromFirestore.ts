import admin from 'firebase-admin';
import { execFileSync } from 'child_process';
import { createStorageProvider } from '../storage';
import { IPersistedConfiguration, ScrapedTransaction } from '../types';
import logger from '../logger';
import { getErrorMessage } from '../formatError';

type CollectionDocument<T> = {
    id: string;
    data: T;
};

type FirestoreValue =
    | { nullValue: null }
    | { booleanValue: boolean }
    | { integerValue: string }
    | { doubleValue: number }
    | { timestampValue: string }
    | { stringValue: string }
    | { bytesValue: string }
    | { referenceValue: string }
    | { geoPointValue: { latitude: number; longitude: number } }
    | { arrayValue: { values?: FirestoreValue[] } }
    | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreRestDocument = {
    name: string;
    fields?: Record<string, FirestoreValue>;
};

let firestoreSourceLogged = false;
let cachedGcloudAccessToken: string | undefined;
let cachedGcloudProjectId: string | undefined;

function logFirestoreSource(message: string) {
    if (firestoreSourceLogged) {
        return;
    }

    logger.log(message);
    firestoreSourceLogged = true;
}

function shouldFallbackToGcloud(error: unknown) {
    const message = getErrorMessage(error);
    return (
        message.includes('Could not load the default credentials') ||
        message.includes('default credentials were not found') ||
        message.includes('The Application Default Credentials are not available')
    );
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
    if (!value) {
        return undefined;
    }

    if ('nullValue' in value) {
        return null;
    }

    if ('booleanValue' in value) {
        return value.booleanValue;
    }

    if ('integerValue' in value) {
        return Number(value.integerValue);
    }

    if ('doubleValue' in value) {
        return value.doubleValue;
    }

    if ('timestampValue' in value) {
        return new Date(value.timestampValue);
    }

    if ('stringValue' in value) {
        return value.stringValue;
    }

    if ('bytesValue' in value) {
        return value.bytesValue;
    }

    if ('referenceValue' in value) {
        return value.referenceValue;
    }

    if ('geoPointValue' in value) {
        return value.geoPointValue;
    }

    if ('arrayValue' in value) {
        return (value.arrayValue.values || []).map(item => decodeFirestoreValue(item));
    }

    if ('mapValue' in value) {
        return Object.fromEntries(
            Object.entries(value.mapValue.fields || {}).map(([key, entryValue]) => [key, decodeFirestoreValue(entryValue)])
        );
    }

    return undefined;
}

function decodeFirestoreDocument<T>(document: FirestoreRestDocument): CollectionDocument<T> {
    const data = Object.fromEntries(
        Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])
    ) as T;

    return {
        id: document.name.split('/').pop()!,
        data,
    };
}

function toDate(value: unknown): Date | undefined {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        const date = value.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined;
    }

    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
}

function getGcloudAccessToken() {
    if (!cachedGcloudAccessToken) {
        cachedGcloudAccessToken = execFileSync('gcloud', ['auth', 'print-access-token'], {
            encoding: 'utf8',
        }).trim();
    }

    return cachedGcloudAccessToken;
}

function getGcloudProjectId() {
    if (!cachedGcloudProjectId) {
        cachedGcloudProjectId =
            process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.GCLOUD_PROJECT ||
            execFileSync('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8' }).trim();
    }

    return cachedGcloudProjectId;
}

async function fetchCollectionViaGcloud<T>(collectionName: string): Promise<Array<CollectionDocument<T>>> {
    logFirestoreSource('Falling back to gcloud user auth for Firestore access');

    const projectId = getGcloudProjectId();
    const accessToken = getGcloudAccessToken();
    const documents: Array<CollectionDocument<T>> = [];
    let pageToken = '';

    do {
        const url = new URL(
            `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`
        );
        url.searchParams.set('pageSize', '1000');

        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Firestore REST request failed for ${collectionName}: ${response.status} ${response.statusText}`);
        }

        const body = (await response.json()) as {
            documents?: FirestoreRestDocument[];
            nextPageToken?: string;
        };

        documents.push(...(body.documents || []).map(document => decodeFirestoreDocument<T>(document)));
        pageToken = body.nextPageToken || '';
    } while (pageToken);

    return documents;
}

async function fetchCollection<T>(collectionName: string): Promise<Array<CollectionDocument<T>>> {
    try {
        if (!admin.apps.length) {
            admin.initializeApp();
        }

        const snapshot = await admin.firestore().collection(collectionName).get();
        logFirestoreSource('Using Application Default Credentials for Firestore access');

        return snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data() as T,
        }));
    } catch (error) {
        if (!shouldFallbackToGcloud(error)) {
            throw error;
        }

        return fetchCollectionViaGcloud<T>(collectionName);
    }
}

/**
 * One-time migration: reads all data from Firestore and writes it to SQLite.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json yarn runCommand:dev migrateFromFirestore
 *
 * This command requires the firebase-admin package and a valid service account.
 * After migration is complete, you can remove firebase-admin and this file.
 */
export const migrateFromFirestore = async function () {
    const sqliteDb = createStorageProvider();

    // --- Migrate configurations ---
    logger.log('Migrating configurations...');
    const configDocuments = await fetchCollection<IPersistedConfiguration>('configurations');
    let configCount = 0;
    for (const doc of configDocuments) {
        const data = doc.data;
        await sqliteDb.updateConfiguration(doc.id, data);
        configCount++;
        logger.log(`  Migrated configuration: ${data.id}`);
    }
    logger.log(`Migrated ${configCount} configurations.`);

    // --- Migrate transactions ---
    logger.log('Migrating transactions...');
    const txDocuments = await fetchCollection<Record<string, unknown>>('transactions');
    logger.log(`Found ${txDocuments.length} transactions in Firestore`);

    const transactions: ScrapedTransaction[] = txDocuments.map(doc => {
        const data = doc.data;
        const date = toDate(data.date) || toDate(data.processedDate) || toDate(data.scrapeDate);
        const processedDate = toDate(data.processedDate) || date;

        if (!date || !processedDate) {
            throw new Error(`Transaction ${doc.id} is missing both date and processedDate`);
        }

        return {
            id: data.id as string | undefined,
            approvalNumber: (data.approvalNumber as number | string | undefined) || 0,
            provider: data.provider as ScrapedTransaction['provider'],
            account: data.account as string,
            date,
            processedDate,
            originalAmount: data.originalAmount as number,
            originalCurrency: data.originalCurrency as string,
            chargedAmount: data.chargedAmount as number,
            description: data.description as string,
            memo: (data.memo as string | undefined) || '',
            installments: (data.installments as ScrapedTransaction['installments']) || null,
            scrapeId: data.scrapeId as string | undefined,
            scrapeDate: toDate(data.scrapeDate),
            userId: data.userId as string,
            status: data.status === 'pending' ? 'pending' : 'completed',
        } as ScrapedTransaction;
    });

    // Use ignoreExisting=true since we're doing a full import and want to overwrite
    const count = await sqliteDb.addTransactions(transactions, true);
    logger.log(`Migrated ${count} transactions to SQLite.`);

    // --- Migrate user notes and categories ---
    logger.log('Migrating user notes and categories...');
    const docsWithNotes = txDocuments.filter(doc => {
        const data = doc.data;
        return data.userNote || data.category;
    });

    if (docsWithNotes.length > 0) {
        const updates = docsWithNotes.map(doc => {
            const data = doc.data;
            return {
                docId: doc.id,
                userNote: (data.userNote as string | undefined) || '',
                category: data.category as string | undefined,
            };
        });
        await sqliteDb.updateById(updates);
        logger.log(`Updated ${updates.length} transactions with user notes/categories.`);
    }

    logger.log('Migration complete!');
};
