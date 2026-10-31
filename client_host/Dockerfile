# syntax=docker/dockerfile:1
# Web app image: built with Vite, served by nginx. Build context: the repository root, because the
# app depends on ../sdk, which depends on ../common.
#     docker build -f client_host/Dockerfile -t panic-control-web .

FROM node:22-alpine AS build
WORKDIR /app
COPY common/ common/
COPY sdk/package.json sdk/package-lock.json sdk/
RUN npm ci --prefix sdk
COPY client_host/package.json client_host/package-lock.json client_host/
RUN npm ci --prefix client_host
COPY sdk/ sdk/
RUN npm run build --prefix sdk
COPY client_host/ client_host/
# Vite writes VITE_ variables into the JavaScript at build time: changing them needs a rebuild.
# Empty values use the defaults described in client_host/.env.example.
ARG VITE_SERVER_URL=""
ARG VITE_PUBLIC_URL=""
ENV VITE_SERVER_URL=${VITE_SERVER_URL} \
    VITE_PUBLIC_URL=${VITE_PUBLIC_URL}
RUN npm run build --prefix client_host

FROM nginx:1.27-alpine AS runtime
COPY client_host/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client_host/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
