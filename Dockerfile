# syntax=docker/dockerfile:1

FROM golang:1.25-alpine AS go-builder

WORKDIR /app/backend

RUN apk add --no-cache build-base

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -o server ./cmd/server

FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine

WORKDIR /app/backend

RUN apk add --no-cache ca-certificates

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/backend/data/dev.db"
ENV LOG_FILE="/app/backend/logs/app.log"
ENV FRONTEND_DIST="/app/frontend/dist"

COPY --from=go-builder /app/backend/server ./server
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backend/data /app/backend/logs

EXPOSE 4000

CMD ["./server"]
