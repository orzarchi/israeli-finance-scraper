import {Account, PersistedTransaction, Provider, ScrapeResult} from "./types";
import _ from "lodash";
import shortid from "shortid";

function mapTransaction(account: Account, providerName: Provider) {
  return account.txns.map(tx => ({
    id: shortid.generate(),
    account: account.accountNumber.trim(),
    provider: providerName,
    chargedAmount: tx.chargedAmount,
    date: new Date(tx.date),
    description: tx.description,
    installments: tx.installments,
    originalAmount: tx.originalAmount,
    originalCurrency: tx.originalCurrency,
    approvalNumber: tx.identifier||0,
    memo: tx.memo
  }));
}

function mapScrape(
  scrape: ScrapeResult,
  providerName: Provider
): PersistedTransaction[] {
  return _.flatten(scrape.accounts.map(x => mapTransaction(x, providerName)));
}

export function processResults(results: {
  [x: string]: ScrapeResult;
}): PersistedTransaction[] {
    return _.flatten(
      Object.keys(results).map(providerName => {
          const scrape = results[providerName];
          return mapScrape(scrape, providerName as Provider);
      })
  );
}
