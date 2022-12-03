import puppeteer from 'puppeteer-core';
import env from './env';

const lambdaOptions = {
    args: [
        // Flags for running in Docker on AWS Lambda
        // https://www.howtogeek.com/devops/how-to-run-puppeteer-and-headless-chrome-in-a-docker-container
        // https://github.com/alixaxel/chrome-aws-lambda/blob/f9d5a9ff0282ef8e172a29d6d077efc468ca3c76/source/index.ts#L95-L118
        // https://github.com/Sparticuz/chrome-aws-lambda/blob/master/source/index.ts#L95-L123
        '--allow-running-insecure-content',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-component-update',
        '--disable-dev-shm-usage',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
        '--disable-ipc-flooding-protection',
        '--disable-print-preview',
        '--disable-setuid-sandbox',
        '--disable-site-isolation-trials',
        '--disable-speech-api',
        '--disable-web-security',
        '--disk-cache-size=33554432',
        '--enable-features=SharedArrayBuffer',
        '--hide-scrollbars',
        '--ignore-gpu-blocklist',
        '--in-process-gpu',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-first-run',
        '--no-pings',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
        '--use-angle=swiftshader',
        '--use-gl=swiftshader',
        '--window-size=1920,1080'
    ],
    defaultViewport: null
};

export function launchPuppeteer() {
    let options = {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: env.HEADLESS,
        executablePath: env.PUPPETEER_EXECUTABLE_PATH,
        channel: env.PUPPETEER_EXECUTABLE_PATH ? undefined : env.PUPPETEER_CHANNEL
    };
    if (process.env.AWS_LAMBDA_RUNTIME_API) {
        options = {
            ...options,
            ...lambdaOptions
        };
    }

    return puppeteer.launch(options);
}
