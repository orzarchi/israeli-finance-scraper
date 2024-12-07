import * as functions from '@google-cloud/functions-framework';
import env from '../env';
import TelegramBot from '../notifications/TelegramBot';
import Db from '../Db';
import moment from 'moment';
import logger from '../logger';
import _ from 'lodash';
import { TransactionUpdate } from '../types';

// Register an HTTP function with the Functions Framework
functions.http('financeScraper', async (req, res) => {
    if (!env.BOT_TOKEN) {
        throw new Error('BOT_TOKEN env var not set!');
    }

    if (!env.CHAT_ID) {
        throw new Error('CHAT_ID env var not set!');
    }

    if (req.query.auth !== process.env.AUTH) {
        res.status(401).send('Unauthorized');
        return;
    }

    const bot = new TelegramBot(env.BOT_TOKEN);

    try {
        await bot.scrape(async x => {
            await bot.sendMessage(env.CHAT_ID!, x);
        });

        res.send('OK');
    } catch (e) {
        res.status(500).send('Error');
    }
});

type TransactionDto = {
    id?: string;
    account: string;
    docId: string;
    date: Date;
    category?: string;
    payee: string;
    amount: number;
    memo: string;
    userNote?: string;
};

async function getTransactions(startDate: Date): Promise<TransactionDto[]> {
    const db = new Db();
    const daysAgo = moment().diff(startDate, 'days');
    logger.info(`Returning transactions ${daysAgo} days back`);
    const transactions = await db.getTransactions(startDate);
    return transactions.map(tx => ({
        id: tx.id,
        account: tx.account,
        docId: tx.docId,
        date: moment(tx.date)
            .tz('Asia/Jerusalem')
            .toDate(),
        category: tx.category,
        payee: tx.description,
        amount: tx.chargedAmount,
        memo: tx.memo
    }));
}

async function updateTransactions(transactions: TransactionUpdate[]) {
    const db = new Db();
    await db.updateById(transactions);
}

functions.http('fetchTransactions', async (req, res) => {
    if (req.query.auth !== process.env.AUTH) {
        res.status(401).send('Unauthorized');
        return;
    }

    if (!req.query.startDate) {
        res.status(400).send('startDate is required');
        return;
    }
    try {
        res.send(await getTransactions(new Date(req.query.startDate.toString())));
    } catch (e) {
        res.status(500).send('Error');
    }
});

functions.http('updateTransactions', async (req, res) => {
    if (req.query.auth !== process.env.AUTH) {
        res.status(401).send('Unauthorized');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    if (!req.body.transactions) {
        res.status(400).send('transactions are required');
        return;
    }

    try {
        await updateTransactions(
            req.body.transactions.map((tx: TransactionUpdate) => _.pick(tx, 'docId', 'userNote', 'category'))
        );
        res.send('OK');
    } catch (e) {
        res.status(500).send('Error');
    }
});
