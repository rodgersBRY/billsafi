# Build from the repository root: docker build -f apps/api/Dockerfile --target <api|migrate> .
FROM node:24-alpine AS base
RUN corepack enable pnpm
WORKDIR /repo

# Keep only the API and the workspace packages it depends on.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.8 prune @billsafi/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@billsafi/api

# Applies Drizzle migrations; run once per deploy before the API starts.
FROM builder AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@billsafi/db", "db:migrate"]

FROM base AS api
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/packages/contracts/dist packages/contracts/dist
COPY --from=builder /repo/packages/db/dist packages/db/dist
# The Health page compares the applied migrations with this journal.
COPY --from=builder /repo/packages/db/drizzle/meta/_journal.json packages/db/drizzle/meta/_journal.json
COPY --from=builder /repo/packages/domain/dist packages/domain/dist
COPY --from=builder /repo/apps/api/dist apps/api/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
