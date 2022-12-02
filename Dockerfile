FROM arm64v8/node:16-alpine

# Installs latest Chromium (100) package. (Puppeteer v13.5.0 works with Chromium 100.)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn \
      dumb-init

# Add user so we don't need --no-sandbox.
RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

WORKDIR /app
COPY --chown=pptruser . .
RUN yarn

ENTRYPOINT ["dumb-init", "--"]
CMD ["yarn", "startWeb"]

