FROM amazon/aws-lambda-nodejs:16
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Required for puppeteer to run
RUN yum install -y amazon-linux-extras
RUN amazon-linux-extras install epel -y

# Chromium dependencies
RUN yum install -y \
  GConf2.x86_64 \
  alsa-lib.x86_64 \
  atk.x86_64 \
  cups-libs.x86_64 \
  gtk3.x86_64 \
  ipa-gothic-fonts \
  libXScrnSaver.x86_64 \
  libXcomposite.x86_64 \
  libXcursor.x86_64 \
  libXdamage.x86_64 \
  libXext.x86_64 \
  libXi.x86_64 \
  libXrandr.x86_64 \
  libXtst.x86_64 \
  pango.x86_64 \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-fonts-Type1 \
  xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-misc \
  xorg-x11-utils

RUN yum update -y nss

# Chromium needs to be installed as a system dependency, not via npm; otherwise there will be an error about missing libatk-1.0
RUN yum install -y chromium

RUN npm install -g yarn
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn set version berry
RUN yarn install

COPY . ${LAMBDA_TASK_ROOT}
RUN yarn build

CMD [ "dist/src/commands/startLambdaHandler.lambdaHandler" ]
