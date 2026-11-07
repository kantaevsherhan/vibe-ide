FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV WORKSPACE_DIR=/workspace
ENV FRONTEND_DIST=/app/apps/frontend/dist
ENV VIBEIDE_CONFIG=/data/vibeide.config.json
ENV VIBEIDE_SETTINGS_CONFIG=/data/settings.json
ENV DOCKER_CONTAINER=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends git bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG VIBEIDE_CLI_PACKAGES=""
RUN if [ -n "$VIBEIDE_CLI_PACKAGES" ]; then npm install --global -- $VIBEIDE_CLI_PACKAGES; fi

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist

RUN install -d -o node -g node /workspace /data

USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => { if (!r.ok) process.exitCode = 1 }).catch(() => { process.exitCode = 1 })"]
CMD ["node", "apps/backend/dist/main.js"]
