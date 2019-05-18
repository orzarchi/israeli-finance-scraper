import {TransactionDetail} from "ynab";
import {CategorizationProvider} from "./index";
import _ from "lodash";

export async function applyLearnedCategories(
    transactions: TransactionDetail[],
    ynabCategoryIdLookup: { [x: string]: string },
    categorizationProvider: CategorizationProvider
): Promise<TransactionDetail[]> {
    let stillUncategorizedTx = [] as TransactionDetail[];
    const byPayees = _.groupBy<TransactionDetail>(transactions, x => x.payee_name);

    const promises = _.map(byPayees, async (tx, payeeName) => {
        if (!payeeName) {
            return;
        }

        const categoryName = await Promise.resolve(categorizationProvider(payeeName));
        if (categoryName) {
            const categoryId = ynabCategoryIdLookup[categoryName];
            if (!categoryId){
                console.warn(`Invalid ynab category ${categoryName}`)
            }

            tx.forEach(x => (x.category_id = categoryId));
        } else {
            stillUncategorizedTx = [...stillUncategorizedTx, ...tx];
        }
    });

    await Promise.all(promises);

    return stillUncategorizedTx;
}
