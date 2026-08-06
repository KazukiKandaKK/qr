# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

ENV DATABASE_URL="file:./data/dev.db"

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
