FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Build tools are required even when Coolify injects NODE_ENV=production.
RUN npm ci --include=dev
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    SWAGGER_ENABLED=false \
    KIOSK_PHOTO_DIRECTORY=/app/data/photos \
    KIOSK_LOG_FILE=/app/data/logs/kiosko-api.jsonl \
    KIOSK_SIGNING_KEY_PATH=/app/data/keys/payroll-signing-private.pem \
    KIOSK_SIGNING_PUBLIC_KEY_PATH=/app/data/keys/payroll-signing-public.pem
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY public ./public
RUN mkdir -p /app/data/photos /app/data/logs /app/data/keys && chown -R node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
