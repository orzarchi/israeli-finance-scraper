import admin from 'firebase-admin';
import { createStorageProvider } from '../storage';
import { IPersistedConfiguration, ScrapedTransaction } from '../types';
import { Configuration } from '../Configuration';
import logger from '../logger';

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
    // Initialize Firebase
    admin.initializeApp();
    const firestore = admin.firestore();

    const sqliteDb = createStorageProvider();

    // --- Migrate configurations ---
    logger.log('Migrating configurations...');
    const configSnapshot = await firestore.collection('configurations').get();
    let configCount = 0;
    for (const doc of configSnapshot.docs) {
        const data = doc.data() as IPersistedConfiguration;
        await sqliteDb.updateConfiguration(doc.id, data);
        configCount++;
        logger.log(`  Migrated configuration: ${data.id}`);
    }
    logger.log(`Migrated ${configCount} configurations.`);

    // --- Migrate transactions ---
    logger.log('Migrating transactions...');
    const txSnapshot = await firestore.collection('transactions').get();
    logger.log(`Found ${txSnapshot.size} transactions in Firestore`);

    const transactions: ScrapedTransaction[] = txSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: data.id,
            approvalNumber: data.approvalNumber || 0,
            provider: data.provider,
            account: data.account,
            date: data.date.toDate(),
            processedDate: data.processedDate.toDate(),
            originalAmount: data.originalAmount,
            originalCurrency: data.originalCurrency,
            chargedAmount: data.chargedAmount,
            description: data.description,
            memo: data.memo || '',
            installments: data.installments || null,
            scrapeId: data.scrapeId,
            scrapeDate: data.scrapeDate?.toDate(),
            userId: data.userId,
            status: data.status,
        } as ScrapedTransaction;
    });

    // Use ignoreExisting=true since we're doing a full import and want to overwrite
    const count = await sqliteDb.addTransactions(transactions, true);
    logger.log(`Migrated ${count} transactions to SQLite.`);

    // --- Migrate user notes and categories ---
    logger.log('Migrating user notes and categories...');
    const docsWithNotes = txSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.userNote || data.category;
    });

    if (docsWithNotes.length > 0) {
        const updates = docsWithNotes.map(doc => {
            const data = doc.data();
            return {
                docId: doc.id,
                userNote: data.userNote || '',
                category: data.category,
            };
        });
        await sqliteDb.updateById(updates);
        logger.log(`Updated ${updates.length} transactions with user notes/categories.`);
    }

    logger.log('Migration complete!');
};
