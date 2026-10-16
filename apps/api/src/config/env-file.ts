import { existsSync } from "node:fs";

/** Load the repository-root .env for local runs; real deployments set variables directly. */
export function loadRootEnvFile(): void {
  const file = new URL("../../../../.env", import.meta.url);
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}
