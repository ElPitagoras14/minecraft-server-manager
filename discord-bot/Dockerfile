FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src /app/src

RUN npm run build

CMD ["npm", "start"]