FROM node:20-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY package.json ./
COPY package-lock.json ./
RUN npm install
COPY . ./
#RUN rm .env
ARG ENVIRONMENT=development
RUN cp .env.${ENVIRONMENT} .env
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--open", "false"]
