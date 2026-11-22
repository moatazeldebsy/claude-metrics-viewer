# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
# Nitro bundles the server and its runtime dependencies into .output
COPY --from=build --chown=app:app /app/.output ./.output
# DATA_SOURCE=otel keeps its SQLite database here (TELEMETRY_DB default): mount a volume to keep it.
RUN mkdir -p /app/.data && chown app:app /app/.data
VOLUME /app/.data
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
