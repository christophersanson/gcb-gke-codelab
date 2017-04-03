FROM node:4

COPY package.json .
RUN npm i --only=production

COPY app app

EXPOSE 8080

CMD npm start