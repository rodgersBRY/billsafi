# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /repo

# Keep only the web app and the workspace packages it depends on.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.8 prune @billsafi/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# The /api rewrite target is fixed at build time, so it points at the Compose service name.
ARG API_INTERNAL_URL=http://api:4000
# Browser error reporting is compiled in; empty leaves it off (D052).
ARG NEXT_PUBLIC_SENTRY_DSN=
# production, staging or development; the admin header shows it. Unset means development.
ARG NEXT_PUBLIC_APP_ENV=
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV NEXT_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@billsafi/web

FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
