import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import env from '../env';
import { createStorageProvider } from '../storage';
import { TransactionUpdate } from '../types';
import logger from '../logger';
import moment from 'moment-timezone';
import _ from 'lodash';
import { scrape } from './scrape';
import { formatError } from '../formatError';

const app = new Hono();
let running = false;

app.use('*', async (c, next) => {
    const startedAt = Date.now();
    const path = new URL(c.req.url).pathname;
    logger.info(`HTTP ${c.req.method} ${path} started`);

    try {
        await next();
    } catch (error) {
        logger.error(`HTTP ${c.req.method} ${path} failed after ${Date.now() - startedAt}ms: ${formatError(error)}`);
        throw error;
    }

    logger.info(`HTTP ${c.req.method} ${path} -> ${c.res.status} in ${Date.now() - startedAt}ms`);
});

// Health check
app.get('/', (c) => {
    return c.json({ isActive: running });
});

// Fetch transactions — used by Google Sheets
app.get('/fetchTransactions', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    const startDateParam = c.req.query('startDate');
    if (!startDateParam) {
        return c.text('startDate is required', 400);
    }

    try {
        const db = createStorageProvider();
        const startDate = new Date(startDateParam);
        const daysAgo = moment().diff(startDate, 'days');
        logger.info(`Returning transactions ${daysAgo} days back`);
        const transactions = await db.getTransactions(startDate);
        return c.json(
            transactions.map(tx => ({
                id: tx.id,
                account: tx.account,
                docId: tx.docId,
                date: moment(tx.date).tz('Asia/Jerusalem').toDate(),
                category: tx.category,
                payee: tx.description,
                amount: tx.chargedAmount,
                memo: tx.memo,
            }))
        );
    } catch (e) {
        logger.error(`Failed to fetch transactions: ${formatError(e)}`);
        return c.text('Error', 500);
    }
});

// Update transactions — used by Google Sheets
app.post('/updateTransactions', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    try {
        const body = await c.req.json();
        if (!body.transactions) {
            return c.text('transactions are required', 400);
        }

        const db = createStorageProvider();
        await db.updateById(
            body.transactions.map((tx: TransactionUpdate) => _.pick(tx, 'docId', 'userNote', 'category'))
        );
        return c.text('OK');
    } catch (e) {
        logger.error(`Failed to update transactions: ${formatError(e)}`);
        return c.text('Error', 500);
    }
});

// Trigger scrape in the background
app.post('/scrapeAsync', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    if (running) {
        logger.warn('Scrape async request ignored because a scrape is already running');
        return c.json({ success: false, reason: 'already running' });
    }

    logger.info('Scrape async request accepted');
    running = true;
    scrape()
        .then(summary => {
            logger.info(
                `Scrape async request completed: ${summary.totals.newTransactions} new, ${summary.totals.updatedTransactions} updates`
            );
        })
        .catch((e) => logger.error(`Scrape async error: ${formatError(e)}`))
        .finally(() => { running = false; });

    return c.json({ success: true });
});

// Trigger scrape and wait for completion
app.post('/scrape', async (c) => {
    if (env.AUTH && c.req.query('auth') !== env.AUTH) {
        return c.text('Unauthorized', 401);
    }

    if (running) {
        logger.warn('Scrape request ignored because a scrape is already running');
        return c.json({ success: false, reason: 'already running' });
    }

    logger.info('Scrape request accepted');
    running = true;

    try {
        const summary = await scrape();
        logger.info(`Scrape request completed: ${summary.totals.newTransactions} new, ${summary.totals.updatedTransactions} updates`);
        return c.json({ success: true, summary });
    } catch (e) {
        const error = formatError(e);
        logger.error(`Scrape request failed: ${error}`);
        return c.json({ success: false, error }, 500);
    } finally {
        running = false;
    }
});

export async function startWeb() {
    const port = env.WEBSERVER_PORT;
    logger.info(`Starting web server on port ${port}`);
    serve({ fetch: app.fetch, port });
}
