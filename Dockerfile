FROM node:22-alpine AS build

WORKDIR /app

# .npmrc carries legacy-peer-deps=true, which CI and Vercel rely on. Without it
# `npm ci` here resolves peers strictly and can fail where CI passes.
COPY package*.json .npmrc ./
RUN npm ci

# Public (browser-safe) build-time configuration. Pass with --build-arg; the
# build's prebuild guard fails fast if the Supabase key is missing or legacy.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

COPY . .
RUN npm run build

# Unprivileged nginx: runs as uid 101, listens on 8080, keeps its pid in /tmp.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

USER root
RUN apk add --no-cache curl
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/wasel-security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health >/dev/null || exit 1
