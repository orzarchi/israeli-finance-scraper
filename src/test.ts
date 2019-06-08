import {scrape} from "./commands/scrape";
import {uploadToYnab} from "./commands/uploadToYnab";
import {changeIds} from "./commands/changeIds";
const command = process.env['command'];

if (!command){
    console.error('no command selected using \'command\' env var')
}
else if(command == 'scrape'){
    scrape().catch(err => console.error(err));
}
else if(command == 'upload'){
    uploadToYnab().catch(err => console.error(err));
}
else if(command == 'changeIds'){
    changeIds().catch(err => console.error(err));
}
