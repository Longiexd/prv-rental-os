#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 <staging|production> <git-sha> <release.tar.gz> <backend.env> <deployment-id>" >&2
  exit 64
}

[[ $# -eq 5 ]] || usage

environment="$1"
git_sha="$2"
archive_path="$3"
backend_env_path="$4"
deployment_id="$5"

[[ "$git_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo "git-sha must be a full 40-character lowercase SHA" >&2
  exit 64
}
[[ "$deployment_id" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo "deployment-id contains unsupported characters" >&2
  exit 64
}
[[ -f "$archive_path" ]] || {
  echo "release archive not found: $archive_path" >&2
  exit 66
}
[[ -f "$backend_env_path" ]] || {
  echo "backend environment file not found: $backend_env_path" >&2
  exit 66
}

archive_path="$(realpath -e "$archive_path")"
backend_env_path="$(realpath -e "$backend_env_path")"
expected_prefix="/tmp/klynx-$environment-"
[[ "$archive_path" == "$expected_prefix"*.tar.gz ]] || {
  echo "release archive must be a klynx deployment file under /tmp" >&2
  exit 64
}
[[ "$backend_env_path" == "$expected_prefix"*.env ]] || {
  echo "backend environment must be a klynx deployment file under /tmp" >&2
  exit 64
}

case "$environment" in
  staging)
    compose_file="docker-compose.staging.yml"
    service_name="backend-staging"
    compose_project="klynx-rental-os-staging"
    env_filename=".env.staging"
    health_url="http://127.0.0.1:8001/ready"
    compose_env_file="deploy/staging.compose.env"
    ;;
  production)
    compose_file="docker-compose.production.yml"
    service_name="backend-production"
    compose_project="klynx-rental-os-production"
    env_filename=".env.production"
    health_url="http://127.0.0.1:8000/ready"
    compose_env_file="deploy/production.compose.env"
    ;;
  *)
    usage
    ;;
esac

release_root="/opt/klynx-rental-os"
environment_root="$release_root/releases/$environment"
release_dir="$environment_root/$git_sha-$deployment_id"
current_link="$release_root/current-$environment"
previous_release=""

if [[ -L "$current_link" ]]; then
  previous_release="$(readlink -f "$current_link")"
fi

mkdir -p "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"
install -d -m 700 "$release_dir/runtime"
install -m 600 "$backend_env_path" "$release_dir/runtime/backend.env"

# First rollout must be bootstrapped explicitly. Never silently create an empty registry.
test -f "/var/lib/klynx/$environment/control/control.sqlite3"
test -s "/etc/klynx/$environment/session.key"
test -s "/etc/klynx/$environment/proxy.key"
admin_python="/opt/klynx-admin/venv/bin/python"
test -x "$admin_python"

cd "$release_dir"
docker compose --project-name "$compose_project" --env-file "$compose_env_file" -f "$compose_file" config --quiet
wait_ready() {
  for _ in {1..30}; do
    if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

healthy=false
if docker compose --project-name "$compose_project" --env-file "$compose_env_file" -f "$compose_file" up -d --build "$service_name"; then
  if "$admin_python" "$release_dir/deploy/admin.py" --environment "$environment" attach-api; then
    if wait_ready; then
      healthy=true
    else
      echo "$environment API readiness check failed" >&2
    fi
  else
    echo "$environment registered Odoo attachment/check failed" >&2
  fi
else
  echo "$environment backend build/start failed" >&2
fi

if [[ "$healthy" != "true" ]]; then
  echo "$environment health check failed; attempting to restore the previous release" >&2
  if [[ -n "$previous_release" && -f "$previous_release/backend/app/control.py" ]]; then
    cd "$previous_release"
    # Network attachment follows today's registry, even when the backend being
    # restored predates a routing repair. Do not rerun the old faulty helper.
    if docker compose --project-name "$compose_project" --env-file "$compose_env_file" -f "$compose_file" up -d --build "$service_name" &&
       "$admin_python" "$release_dir/deploy/admin.py" --environment "$environment" attach-api &&
       wait_ready; then
      echo "$environment previous release restored and ready; candidate deployment failed" >&2
    else
      echo "$environment rollback did not become ready; keep traffic gated and inspect the failure above" >&2
    fi
  else
    echo "Refusing rollback to the old unauthenticated API. Keep traffic gated and fix this release." >&2
  fi
  exit 1
fi

ln -sfn "$release_dir" "$current_link"
printf '%s\n' "$git_sha" >"$release_root/current-$environment.sha"
chmod 600 "$release_root/current-$environment.sha"

rm -f "$archive_path" "$backend_env_path"
echo "Deployed $environment release $git_sha"
