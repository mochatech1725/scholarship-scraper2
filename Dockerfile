FROM public.ecr.aws/lambda/nodejs:18

# Install system dependencies for Puppeteer
RUN yum update -y && \
    yum install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libxtst6 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    && yum clean all

# Set working directory
WORKDIR /var/task

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY cdk/config/ ./cdk/config/
COPY package*.json ./
COPY tsconfig.json ./

# Create non-root user for security
RUN groupadd -r scraper && useradd -r -g scraper scraper
USER scraper

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Default command
CMD ["src/batch/index.js"] 