FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
  && python3 -m pip install --no-cache-dir --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx playwright install --with-deps chromium
RUN npx prisma generate
EXPOSE 8000
CMD ["sh", "-c", "npm run prisma:deploy && (npm run worker & npm start)"]
