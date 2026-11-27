# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# TEST IMAGE ONLY: the AI packages below are old, vulnerable versions for AI-BOM scanner testing.
FROM python:3.10-slim-bookworm AS ai-python
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements-ai.txt /tmp/
WORKDIR /tmp
RUN python3.10 -m venv /opt/ai-venv \
  && /opt/ai-venv/bin/pip install --no-cache-dir -r requirements-ai.txt \
       --extra-index-url https://download.pytorch.org/whl/cpu

FROM node:22-bookworm-slim AS ai-node
WORKDIR /opt/ai-node
COPY ai-node/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-bookworm-slim
ENV NODE_ENV=production
# Python 3.10 runtime for the AI virtual environment
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libbz2-1.0 libdb5.3 libexpat1 libffi8 libgdbm6 libgomp1 liblzma5 \
      libncursesw6 libreadline8 libsqlite3-0 libssl3 libuuid1 zlib1g \
  && rm -rf /var/lib/apt/lists/*
COPY --from=ai-python /usr/local/bin/python3.10 /usr/local/bin/
COPY --from=ai-python /usr/local/lib/libpython3.10.so.1.0 /usr/local/lib/
COPY --from=ai-python /usr/local/lib/python3.10 /usr/local/lib/python3.10
RUN ldconfig
# Dedicated AI package layers (Python, then Node)
COPY --from=ai-python /opt/ai-venv /opt/ai-venv
COPY --from=ai-node /opt/ai-node /opt/ai-node
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json app.js ai.js config.js ./
RUN mkdir -p /app/public && chown node:node /app/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('net').connect(3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"]
CMD ["node", "app.js"]
