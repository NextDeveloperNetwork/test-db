# Multi-stage optimized Node.js Dockerfile for PostgreFlow
FROM node:20-alpine AS base

WORKDIR /app

# Copy package manifests first for efficient docker layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma Client
RUN npm ci
RUN npx prisma generate

# Copy source code
COPY server.js ./
COPY public ./public/
COPY .env ./

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
