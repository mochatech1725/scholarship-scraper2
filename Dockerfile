# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json tsconfig.docker.json ./

# Compile TypeScript using Docker-specific config
RUN npx tsc -p tsconfig.docker.json

# Copy runtime config file for scrapers
COPY cdk/config/scraper-config.json dist/cdk/config/scraper-config.json

# Remove dev dependencies and CDK files to reduce image size
RUN npm prune --production
RUN rm -rf src/cdk/ tsconfig.docker.json

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S scraper -u 1001

# Change ownership of the app directory
RUN chown -R scraper:nodejs /app
USER scraper

# Set the entry point
ENTRYPOINT ["node", "dist/src/batch/index.js"] 