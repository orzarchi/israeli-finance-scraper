FROM ghcr.io/puppeteer/puppeteer:19.3.0

USER root
RUN apt update
RUN apt install dumb-init
USER pptruser


WORKDIR /app
COPY --chown=pptruser . .
RUN yarn

ENTRYPOINT ["dumb-init", "--"]
CMD ["yarn", "startWeb"]

