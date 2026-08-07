# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/prisma ./backend/prisma
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

RUN cd backend && npm run build

COPY frontend/package*.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig*.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/src ./frontend/src

RUN cd frontend && npm ci && npm run build

FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/backend/data/dev.db"

COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma

RUN cd backend && npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/backend/data

WORKDIR /app/backend

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
