import { readCsv, writeCsv } from '../files';

const fileName = 'categorization.csv';

class CsvFileCategorizationProvider {
    private cachedCategoryMapping: string[][] | null = null;
    private createFilePromise: Promise<any> | null = null;

    private async ensureFile() {
        if (this.cachedCategoryMapping) {
            return;
        }

        if (this.createFilePromise) {
            await this.createFilePromise;
            return;
        }

        this.createFilePromise = new Promise(async resolve => {
            try {
                this.cachedCategoryMapping = await readCsv(fileName);
            } catch (err) {
                this.cachedCategoryMapping = [];
                await this.updateFile();
            }

            resolve();
        });

        return this.createFilePromise;
    }

    private updateFile() {
        return writeCsv(fileName, this.cachedCategoryMapping!);
    }

    async getCategory(payee: string) {
        await this.ensureFile();

        const matchingCategory = this.cachedCategoryMapping!.find(x => x[0] === payee);
        if (matchingCategory) {
            return matchingCategory[1];
        }

        this.cachedCategoryMapping!.push([payee, '']);
        await this.updateFile();

        return '';
    }
}

const provider = new CsvFileCategorizationProvider();
export const csvFileCategorizationProvider = provider.getCategory.bind(provider);
