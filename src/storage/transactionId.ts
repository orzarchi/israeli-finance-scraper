import { ScrapedTransaction } from '../types';
import moment from 'moment-timezone';

export function getUniqueDbId(transaction: ScrapedTransaction): string {
    const date = transaction.date;

    // New new way of generating unique id - using the existing one from provider + date for repeating transactions
    if (transaction.date >= new Date(2025, 1, 14) && transaction.id) {
        return `${transaction.provider}-${transaction.account}-${moment(transaction.date).format('YYYY-MM-DD')}-${
            transaction.id
        }`;
    }

    // New way of generating unique id - using the existing one from provider
    if (transaction.date > new Date(2024, 11, 1) && transaction.id) {
        return `${transaction.provider}-${transaction.account}-${transaction.id}`;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = moment(date).format('DD');
    const dateString = `${date.getFullYear()}-${month}-${day}`;
    let formattedInstallments = transaction.installments
        ? `${transaction.installments.number}/${transaction.installments.total}`
        : null;
    let uniqueId = `${transaction.provider}-${transaction.account}-${dateString}-${transaction.description.slice(
        0,
        4
    )}-${transaction.chargedAmount}${formattedInstallments ? '-' + formattedInstallments : ''}`;
    return uniqueId.replace(/[ /]/g, '');
}

export function getUniqueIdsForBatch(transactions: ScrapedTransaction[]): string[] {
    const seenAlready = new Set<string>();
    return transactions.map(x => {
        const uniqueDbId = getUniqueDbId(x);
        let uniqueDbIdWithPostfix = uniqueDbId;
        let index = 2;
        while (seenAlready.has(uniqueDbIdWithPostfix)) {
            uniqueDbIdWithPostfix = `${uniqueDbId}-${index}`;
            index += 1;
        }

        seenAlready.add(uniqueDbIdWithPostfix);
        return uniqueDbIdWithPostfix;
    });
}
