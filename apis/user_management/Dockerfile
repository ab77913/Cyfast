FROM node:20-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY ["UserManagement/package*.json", "./"]
RUN npm install
COPY ["UserManagement/.", "./"]
#RUN rm .env
EXPOSE 8087
CMD ["npm", "start"]