FROM ghcr.io/puppeteer/puppeteer:19.3.0

WORKDIR /app
COPY --chown=pptruser . .
RUN yarn

CMD ["yarn", "startBotAndScrape"]

