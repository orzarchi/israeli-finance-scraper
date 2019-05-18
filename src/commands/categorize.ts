import {getUncategorizedTransactions, getYnabCategoryIdLookup, updateTransactions} from '../ynab';
import {configuration} from '../env';
import _ from 'lodash';
import {csvFileCategorizationProvider} from "../categorization/CsvFileCategorizationProvider";
import {CategorizationProvider} from "../categorization";
import {applyLearnedCategories} from "../categorization/apply";

async function categorize(
    budgetId: string,
    ...categorizationProviders: CategorizationProvider[]
) {
    const ynabCategoryIdLookup = (await getYnabCategoryIdLookup(budgetId)).map(x => [x.name,x.id]);
    const uncategorizedTx = await getUncategorizedTransactions(budgetId);
    let stillUncategorizedTx = uncategorizedTx;

    for(const categorizationProvider of categorizationProviders){
        stillUncategorizedTx = await applyLearnedCategories(
            stillUncategorizedTx,
            _.fromPairs(ynabCategoryIdLookup),
            categorizationProvider
        );
    }

    for (const uncategorizedTx of Object.keys(_.groupBy(stillUncategorizedTx,x=>x.payee_name))){
        console.warn(`Unknown category for payee ${uncategorizedTx}`);
    }

    const newlyCategorizedTx = _.difference(uncategorizedTx,stillUncategorizedTx);

    if (newlyCategorizedTx.length) {
        console.info(`Categorized ${newlyCategorizedTx.length} transactions`);
        await updateTransactions(budgetId, newlyCategorizedTx);
    }
}

categorize(configuration.ynabBudgets[0].id, csvFileCategorizationProvider).catch(err => console.error(err));
