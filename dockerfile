FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build || true

EXPOSE 3000

CMD ["npm", "start"]
npm-debug.log
.git
.gitignore
.env
.DS_Store
dist
build
.next
coverage
