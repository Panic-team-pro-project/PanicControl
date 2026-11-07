# syntax=docker/dockerfile:1
# Server image. Build context: the repository root, because the server depends on ../common.
#     docker build -f server/Dockerfile -t panic-control-server .

FROM node:22-alpine AS build
WORKDIR /app/server
COPY common/ /app/common/
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app/server
COPY common/ /app/common/
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/" || exit 1
CMD ["node", "dist/server.mjs"]
