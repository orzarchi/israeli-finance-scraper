import Db from '../Db';
import { FinanciaAccountConfiguration, IPersistedConfiguration } from '../types';
import { CompanyTypes, createScraper, OneZeroScraper } from 'israeli-bank-scrapers-core';
import { choice, question, confirm } from './cli';

async function configureAccountOtpContext(configurationToEdit: Partial<IPersistedConfiguration>, relevantAccount: FinanciaAccountConfiguration) {
    if (relevantAccount.companyId !== CompanyTypes.oneZero) {
        console.error(`Only ${CompanyTypes.oneZero} is supported right now`);
        return;
    }
    if (!('email' in relevantAccount.credentials)) {
        return;
    }

    const answer = await confirm(`Fetch OTP context for ${relevantAccount.companyId} account?`);
    if (!answer) {
        return;
    }

    let phoneNumber;

    if ('phoneNumber' in relevantAccount.credentials && relevantAccount.credentials.phoneNumber) {
        phoneNumber = relevantAccount.credentials.phoneNumber;
    } else {
        phoneNumber = await question(`Phone Number?`);
        relevantAccount.credentials.phoneNumber = phoneNumber;
    }

    const scraper = createScraper({
        companyId: relevantAccount.companyId,
        showBrowser: false,
        verbose: false,
        futureMonthsToScrape: 2,
        startDate: new Date()
    });

    const result = await (scraper as OneZeroScraper).login({
        email: relevantAccount.credentials.email,
        password: relevantAccount.credentials.password,
        phoneNumber,
        otpCodeRetriever: async () => {
            let otpCode;
            while (!otpCode) {
                otpCode = await question('OTP Code?');
            }

            return otpCode;
        }
    });

    if (!result.success) {
        console.error(JSON.stringify(result));
        throw new Error(result.errorMessage);
    }

    relevantAccount.credentials.otpLongTermToken = result.persistentOtpToken;
}

export const getOtpContext = async function() {
    const db = new Db();
    const configurations = await db.getConfigurations();
    if (!configurations.length) {
        console.log('no configurations');
        return;
    }
    const configurationId = await choice('Which configuration?', configurations.map(x => x.id));
    const configurationToEdit = configurations.find(x => x.id === configurationId)!;

    let relevantAccounts = configurationToEdit.accountsConfig.filter(x => x.companyId === CompanyTypes.oneZero);
    let relevantAccount = relevantAccounts[0];
    if (!relevantAccount) {
        console.log('No account with otp');
        return;
    }

    if (relevantAccounts.length > 1) {
        const relevantAccountId = await choice(
            'Account to fetch OTP context for?',
            relevantAccounts.map(x => `${x.id} (${x.companyId})`),
            relevantAccounts.map(x => x.id)
        );

        relevantAccount = relevantAccounts.find(x => x.id === relevantAccountId)!;
    }

    await configureAccountOtpContext(configurationToEdit, relevantAccount);
    await db.updateConfiguration(configurationToEdit.persistenceId, configurationToEdit.toJson());
};
