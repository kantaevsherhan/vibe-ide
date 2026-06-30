FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV WORKSPACE_DIR=/workspace
ENV FRONTEND_DIST=/app/apps/frontend/dist

RUN apt-get update \
  && apt-get install -y --no-install-recommends git bash \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist

RUN mkdir -p /workspace

EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "apps/backend"]
