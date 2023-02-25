import { prompt } from 'enquirer';
import _ from 'lodash';

export async function question(message: string): Promise<string> {
    const answers = await questions(message);
    return answers[0];
}

export async function questions(...messages: string[]): Promise<string[]> {
    const responses = (await prompt(
        messages.map((message: string, index: number) => ({
            type: 'input',
            name: 'answer' + index,
            message
        }))
    )) as { [x: string]: string };

    return _(responses)
        .keys()
        .sort()
        .value()
        .map((x: string) => responses[x]);
}

export async function choice(message: string, labels: string[], choices?: string[]) {
    if (choices && labels.length !== choices.length) {
        throw new Error('When using "choice" labels should match choices');
    }

    const result = await prompt({
        type: 'select',
        name: 'choices',
        choices: labels,
        message
    });

    let selection = (result as { [x: string]: string }).choices;

    if (choices) {
        return choices[labels.indexOf(selection)];
    }

    return selection;
}

export async function confirm(message: string) {
    const result = await prompt({
        type: 'confirm',
        name: 'answer',
        message
    });

    return (result as { answer: boolean }).answer;
}
