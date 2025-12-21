FROM node:20-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

WORKDIR /app

# Install system dependencies (PostgreSQL, Chromium for Puppeteer, and utilities)
RUN apt-get update && apt-get install -y \
    openssl \
    bash \
    postgresql \
    postgresql-contrib \
    chromium \
    libglib2.0-0 \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    procps \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Setup PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data /run/postgresql && \
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql && \
    su postgres -c "/usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data"

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production || npm install --only=production

# Copy application code
COPY . .

# Set environment variable for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Make start.sh executable
RUN chmod +x /app/start.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=legalforms

# Start PostgreSQL, create database, and run start.sh
CMD ["bash", "-c", "su postgres -c '/usr/lib/postgresql/15/bin/pg_ctl start -D /var/lib/postgresql/data -l /var/lib/postgresql/logfile' && sleep 2 && su postgres -c '/usr/lib/postgresql/15/bin/createdb legalforms' 2>/dev/null; /app/start.sh"]
