FROM node:18-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY ["ReportManagement/package*.json", "./"]
RUN npm install
COPY ["ReportManagement/.", "./"]
#RUN rm .env
RUN apk add --no-cache chromium yarn icu-libs
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN npm install puppeteer
# Puppeteer v13.5.0 works with Chromium 100.
# RUN yarn add puppeteer@13.5.0
# Add user so we don't need --no-sandbox.
# Run everything after as non-privileged user.
EXPOSE 8089
CMD ["npm", "start"]