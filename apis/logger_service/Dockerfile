FROM node:20-alpine

ENV PYTHONUNBUFFERED=1
RUN apk add --no-cache python3 py3-pip py3-virtualenv
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache --upgrade pip setuptools
RUN pip install --no-cache robotframework

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY ["LoggerService/package*.json", "./"]
RUN npm install
COPY ["LoggerService/.", "./"]
EXPOSE 8090
CMD ["npm", "start"]
