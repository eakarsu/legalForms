FROM node:24

# Set environment variables for non-interactive package installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
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
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Use the official PostgreSQL repository setup method
RUN apt-get update && apt-get install -y postgresql-common && \
    /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y && \
    apt-get update && \
    apt-get install -y postgresql postgresql-contrib && \
    rm -rf /var/lib/apt/lists/*

USER postgres

RUN echo "🔄 Starting PostgreSQL initialization..." && \
    /etc/init.d/postgresql start && \
    echo "✅ PostgreSQL started" && \
    psql --command "ALTER USER postgres WITH PASSWORD 'sel33man';" && \
    echo "✅ PostgreSQL password set" && \
    echo "📋 Current databases before setup:" && \
    psql --command "\l" && \
    /etc/init.d/postgresql stop && \
    echo "✅ PostgreSQL initialization completed"

# Run database setup with debug output
RUN echo "🚀 Running database setup script..." && \
    /etc/init.d/postgresql start && \
    node scripts/setup-database.js && \
    echo "📋 Final database list:" && \
    psql --command "\l" && \
    echo "🔍 Checking legalforms database specifically:" && \
    psql --command "SELECT 1 FROM pg_database WHERE datname = 'legalforms';" && \
    /etc/init.d/postgresql stop && \
    echo "✅ Database setup verification completed"

USER root
# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Set environment variable for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["sh", "-c", "service postgresql start && npm start"]

