#!/usr/bin/env sh
# Updates production to one image tag: pull, migrate, restart, health check.
# Run on the droplet from /opt/tallynest:
#   ./deploy.sh          deploy the newest images (tag `latest`)
#   ./deploy.sh <sha>    deploy a specific commit, e.g. to roll back
set -eu

tag="${1:-latest}"
cd "$(dirname "$0")"

prefix="$(sed -n 's/^IMAGE_PREFIX=//p' .env)"
domain="$(sed -n 's/^DOMAIN=//p' .env)"
current_tag="$(sed -n 's/^IMAGE_TAG=//p' .env)"

# The commit currently running, read before `latest` is overwritten by the pull.
revision() {
  docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1" 2>/dev/null || echo unknown
}
previous="$(revision "${prefix}-api:${current_tag}")"

sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${tag}/" .env

if ! docker compose pull api web migrate; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${current_tag}/" .env
  echo "Pull failed; nothing changed. Is the droplet logged in to ghcr.io?" >&2
  exit 1
fi
deploying="$(revision "${prefix}-api:${tag}")"
echo "Deploying ${deploying} (currently running: ${previous})."
if [ "${previous}" = "unknown" ]; then rollback="no earlier release recorded"; else rollback="./deploy.sh ${previous}"; fi

docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d --remove-orphans --wait

for attempt in 1 2 3 4 5 6; do
  if wget -qO- "https://${domain}/api/v1/health" >/dev/null 2>&1; then
    echo "Deployed ${deploying}. Roll back with: ${rollback}"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done

echo "Health check failed for ${deploying}. Roll back with: ${rollback}" >&2
exit 1
