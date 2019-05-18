import parse from 'csv-parse';
import fs from 'fs';
import {promisify} from "util";
const writeFile = promisify(fs.writeFile);

export function readCsv(file: string):Promise<string[][]> {
    return new Promise((resolve, reject) => {
        fs.readFile(file, (err, fileData) => {
            if (err) {
                return reject(err);
            }

            parse(fileData.toString(), {}, function(err?: Error, rows?: string[][]) {
                if (err || !rows) {
                    return reject(err);
                }

                resolve(rows);
            });
        });
    });
}

export function writeCsv(filePath:string, values:string[][]){
    return writeFile(filePath,values.map(x=>x.join(',')).join('\n'))
}
