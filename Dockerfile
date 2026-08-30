# Multi-stage optimized Node.js Dockerfile for PostgreFlow
FROM node:20-alpine AS base

WORKDIR /app

# Copy package manifests first for efficient docker layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma Client
RUN npm ci
RUN npx prisma generate

# Copy source code & modular directories
COPY server.js ./
COPY db ./db/
COPY routes ./routes/
COPY public ./public/

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
