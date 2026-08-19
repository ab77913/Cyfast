FROM node:20-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY ["GeneralManagement/package*.json", "./"]
RUN npm install
COPY ["GeneralManagement/.", "./"]
#RUN rm .env
EXPOSE 8088
CMD ["npm", "start"]
