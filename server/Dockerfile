# Server Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm i --omit=dev || npm i --production
COPY . .
ENV PORT=3001
EXPOSE 3001
CMD ["npm","start"]
