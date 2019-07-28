## Getting Started

1) Create firestore account
2) Place `firebase-service-account.json` file in root dir
3) Install all dependencies using `yarn build`
3) Run `yarn configure` to configure your scrapers and optional YNAB integration
4) That's it! 

## Available Commands (NPM Scripts)
1) **scrape** - run all scrapers for all stored configurations, and save them to firestore.
2) **uploadToYnab** - Upload to YNAB (Valid YNAB API key required)
3) **startBot** - Start a telegram bot. See required env vars below
4) **startBotAndScrape** - Starts a scrape command, sending logs to a telegram user indicated by **CHAT_ID** env var. Does not require a running telegram bot. Good for scheduled tasks.
5) **configure** - Create or edit user configurations.

## Supported Telegram bot commands
1) `/tx [number of days]` - print a summary of all transactions in the last few days. Default number of days is 5.
2) `/scrape` - trigger a scrape and upload to YNAB.


## Heroku integration (Optional)
Heroku is supported. 
1) Create an heroku app, and set the required env vars marked **Required for heroku integration**.
2) Add the [Puppeteer buildpack](https://github.com/jontewks/puppeteer-heroku-buildpack.git).

## Environment Variables
1) **ONLY_PROVIDERS** - Comma delimited list. Scraper types to run.
2) **ONLY_ACCOUNTS** - Comma delimited list. Scraper accounts to run.
3) **MONTHS_TO_SCRAPE** - Number of months to scrape/upload to ynab. Period always start from the start of the month. (i.e. Passing 0 means to just start at current month)
4) **BOT_TOKEN** - (Required for telegram bot) - Bot token, as obtained from the telegram @botfather
5) **CHAT_ID** - (Required for telegram bot) - Telegram user to receive logs from the telegram bot "scrape" command
6) **GOOGLE_CREDENTIALS** - (Required for heroku integration) - A base 64 version of the `firebase-service-account.json` file.
7) **HEROKU_ADDRESS** - (Required for heroku integration + running a telegram bot) - Full address pointing to heroku app. (e.g. https://awesome-scraper.herokuapp.com
)
