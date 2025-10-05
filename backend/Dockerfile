# Backend (Express + Node.js)
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install -g nodemon && npm install

COPY . .

# 👇 Ensure Prisma client is generated inside the container
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]

