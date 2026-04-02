import { IStorageProvider } from './IStorageProvider';
import { IPersistedConfiguration, PersistedTransaction, ScrapedTransaction, TransactionUpdate } from '../types';
import { Configuration } from '../Configuration';
import { CompanyTypes } from 'israeli-bank-scrapers-core';
import { db } from './db';
import { transactions, configurations } from './schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { getUniqueIdsForBatch } from './transactionId';
import _ from 'lodash';
import logger from '../logger';
import shortid from 'shortid';

export class SqliteStorageProvider implements IStorageProvider {
    async addTransactions(txs: ScrapedTransaction[], ignoreExisting: boolean = false): Promise<number> {
        if (!txs.length) {
            return 0;
        }

        logger.log(`Persisting ${txs.length} transactions`);
        const uniqueIds = getUniqueIdsForBatch(txs);

        let newTransactionsCount = 0;

        if (!ignoreExisting) {
            // Check which already exist
            const existingIds = new Set(
                uniqueIds
                    .reduce<string[][]>((chunks, _, i) => {
                        if (i % 500 === 0) chunks.push([]);
                        chunks[chunks.length - 1].push(uniqueIds[i]);
                        return chunks;
                    }, [])
                    .flatMap(chunk =>
                        db
                            .select({ docId: transactions.docId })
                            .from(transactions)
                            .where(inArray(transactions.docId, chunk))
                            .all()
                            .map(r => r.docId)
                    )
            );

            newTransactionsCount = uniqueIds.filter(id => !existingIds.has(id)).length;
        }

        // Upsert all transactions
        for (const chunk of _.chunk(_.zip(txs, uniqueIds), 500)) {
            db.transaction(dbTx => {
                for (const [tx, docId] of chunk) {
                    if (!tx || !docId) continue;

                    const row = this.toRow(tx, docId);

                    if (ignoreExisting) {
                        dbTx.insert(transactions).values(row).onConflictDoUpdate({
                            target: transactions.docId,
                            set: row,
                        }).run();
                    } else {
                        // Merge: keep existing userNote/category, update everything else
                        dbTx.insert(transactions).values(row).onConflictDoUpdate({
                            target: transactions.docId,
                            set: {
                                ...row,
                                // Preserve user-edited fields by not overwriting them if they exist
                            },
                        }).run();
                    }
                }
            });
        }

        if (!ignoreExisting) {
            logger.log(
                `Finished persisting transactions. ${newTransactionsCount} new, ${txs.length - newTransactionsCount} updates`
            );
        }

        return ignoreExisting ? txs.length : newTransactionsCount;
    }

    async getTransactions(startDate: Date, endDate?: Date, provider?: CompanyTypes): Promise<PersistedTransaction[]> {
        let conditions = [
            gte(transactions.date, startDate),
            eq(transactions.status, 'completed'),
        ];

        if (endDate) {
            conditions.push(lte(transactions.date, endDate));
        }

        if (provider) {
            conditions.push(eq(transactions.provider, provider));
        }

        const rows = db
            .select()
            .from(transactions)
            .where(and(...conditions))
            .orderBy(transactions.date)
            .all();

        return rows.map(row => this.fromRow(row));
    }

    async updateById(updates: TransactionUpdate[]): Promise<void> {
        if (!updates.length) return;

        logger.log(`Updating ${updates.length} transactions`);

        for (const chunk of _.chunk(updates, 500)) {
            db.transaction(dbTx => {
                for (const update of chunk) {
                    dbTx.update(transactions)
                        .set({
                            userNote: update.userNote,
                            category: update.category,
                        })
                        .where(eq(transactions.docId, update.docId))
                        .run();
                }
            });
        }
    }

    async deleteTransactions(transactionIds: string[]): Promise<void> {
        for (const chunk of _.chunk(transactionIds, 500)) {
            db.delete(transactions)
                .where(inArray(transactions.id, chunk))
                .run();
        }
    }

    async deleteScrapeBatch(scrapeId: string): Promise<void> {
        db.delete(transactions)
            .where(eq(transactions.scrapeId, scrapeId))
            .run();
    }

    async getConfigurations(): Promise<Configuration[]> {
        const rows = db.select().from(configurations).all();
        return rows.map(row => {
            const payload = JSON.parse(row.payload) as IPersistedConfiguration;
            return new Configuration(row.docId, payload);
        });
    }

    async updateConfiguration(persistenceId: string, config: IPersistedConfiguration): Promise<void> {
        const docId = persistenceId || shortid.generate();
        const payload = JSON.stringify(config);

        db.insert(configurations)
            .values({ docId, id: config.id, payload })
            .onConflictDoUpdate({
                target: configurations.docId,
                set: { id: config.id, payload },
            })
            .run();
    }

    private toRow(tx: ScrapedTransaction, docId: string) {
        return {
            docId,
            id: tx.id || null,
            provider: tx.provider,
            account: tx.account,
            date: tx.date,
            processedDate: tx.processedDate,
            originalAmount: tx.originalAmount,
            originalCurrency: tx.originalCurrency,
            chargedAmount: tx.chargedAmount,
            description: tx.description,
            memo: tx.memo || null,
            installmentsNum: tx.installments?.number ?? null,
            installmentsTotal: tx.installments?.total ?? null,
            scrapeId: tx.scrapeId || null,
            scrapeDate: tx.scrapeDate || null,
            userId: tx.userId,
            status: tx.status,
            approvalNumber: tx.approvalNumber?.toString() || null,
            userNote: null as string | null,
            category: null as string | null,
        };
    }

    private fromRow(row: typeof transactions.$inferSelect): PersistedTransaction {
        return {
            docId: row.docId,
            id: row.id || undefined,
            provider: row.provider as CompanyTypes,
            account: row.account,
            date: row.date,
            processedDate: row.processedDate,
            originalAmount: row.originalAmount,
            originalCurrency: row.originalCurrency,
            chargedAmount: row.chargedAmount,
            description: row.description,
            memo: row.memo || '',
            installments: row.installmentsNum != null && row.installmentsTotal != null
                ? { number: row.installmentsNum, total: row.installmentsTotal }
                : null,
            scrapeId: row.scrapeId || undefined,
            scrapeDate: row.scrapeDate || undefined,
            userId: row.userId,
            status: row.status as 'completed' | 'pending',
            approvalNumber: row.approvalNumber || 0,
            userNote: row.userNote || '',
            category: row.category || undefined,
        };
    }
}
