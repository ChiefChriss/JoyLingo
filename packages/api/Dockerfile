# JoyLingo API + Miruro sidecar — Railway (monorepo root is build context)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/pipeline/package.json packages/pipeline/tsconfig.json packages/pipeline/
COPY packages/player-core/package.json packages/player-core/tsconfig.json packages/player-core/
COPY packages/api/package.json packages/api/tsconfig.json packages/api/

RUN npm ci

COPY packages/shared/src packages/shared/src
COPY packages/pipeline/src packages/pipeline/src
COPY packages/pipeline/scripts packages/pipeline/scripts
COPY packages/pipeline/data/.gitkeep packages/pipeline/data/.gitkeep
COPY packages/player-core/src packages/player-core/src
COPY packages/api/src packages/api/src
COPY packages/web/public/episodes packages/web/public/episodes
COPY packages/web/public/kanji packages/web/public/kanji
COPY packages/web/public/curriculum packages/web/public/curriculum

RUN npm run build
RUN npm run download-jmdict -w @joylingo/pipeline

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    yt-dlp \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV API_DATA_DIR=/data
ENV MIRURO_API_URL=http://127.0.0.1:8000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages

COPY sidecar/requirements.txt /app/sidecar/requirements.txt
RUN python3 -m venv /app/sidecar/.venv \
  && /app/sidecar/.venv/bin/pip install --no-cache-dir -r /app/sidecar/requirements.txt
COPY sidecar/api.py /app/sidecar/api.py
COPY packages/api/start.sh /app/packages/api/start.sh
RUN chmod +x /app/packages/api/start.sh

# Prefer venv python/uvicorn on PATH for start.sh
ENV PATH="/app/sidecar/.venv/bin:${PATH}"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/packages/api/start.sh"]
