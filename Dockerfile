FROM node:20-bullseye-slim

# Install essential tools
RUN apt-get update && apt-get install -y \
    bash curl wget git nano vim htop procps \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy application
COPY index.js ./
COPY public/ ./public/

# Create log directory
RUN mkdir -p /var/log/magoco-terminal && chmod 777 /var/log/magoco-terminal

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENV PORT=3000 \
    HOST=0.0.0.0 \
    WORK_DIR=/tmp \
    LOG_DIR=/var/log/magoco-terminal

CMD ["node", "index.js"]
