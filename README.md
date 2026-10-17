# TallyNest

Invoicing for Kenyan freelancers and independent professionals. Product and design specifications live in [docs/](docs/README.md).

## Layout

| Path              | What it is                                                       |
| ----------------- | ---------------------------------------------------------------- |
| `apps/web`        | Next.js frontend                                                 |
| `apps/api`        | NestJS backend, served under `/api/v1`                           |
| `packages/db`     | Drizzle schema, client and migrations                            |
| `packages/domain` | Pure business logic shared by web and API (money, invoice rules) |
| `packages/config` | Shared TypeScript configuration                                  |
| `deploy`          | Production stack and droplet setup guide                         |

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm, enabled through Corepack: `corepack enable pnpm`
- Docker, for the local Postgres database

## Getting started

```sh
cp .env.example .env
pnpm install
pnpm db:up        # Postgres 18 on localhost:5434
pnpm db:migrate
pnpm dev          # web on :3000, API on :4000
```

Check the API with `curl localhost:4000/api/v1/health`.

## Common commands

| Command            | Runs                                             |
| ------------------ | ------------------------------------------------ |
| `pnpm build`       | Builds every package and app                     |
| `pnpm typecheck`   | TypeScript checks                                |
| `pnpm lint`        | ESLint                                           |
| `pnpm test`        | Unit tests (Vitest)                              |
| `pnpm test:e2e`    | API end-to-end tests; needs the database running |
| `pnpm db:generate` | Creates a migration from schema changes          |
| `pnpm format`      | Formats the repository with Prettier             |
