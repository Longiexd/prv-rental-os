# Staging and production infrastructure

This repository uses one codebase and promotes the same tested Git commit
between two isolated environments.

This package was prepared from `origin/main` commit
`52b358a619e0d27dcb2fd1cb53d69cb264766aeb`.

| Concern | Staging | Production |
| --- | --- | --- |
| Git branch | `staging` | protected `main` |
| Frontend | `staging.rental-os.klynx.net` | `rental-os.klynx.net` |
| API | `api-staging.klynx.net` | `api.klynx.net` |
| Worker | `prv-rental-os-staging` | `prv-rental-os-production` |
| Wrangler environment | `staging` | `production` |
| Backend port on VPS | loopback `8001` | loopback `8000` |
| Backend environment file | `.env.staging` | `.env.production` |
| Odoo | isolated staging instance | client production instance |
| Deployment | every push | manual promotion plus approval |
| Browser access | Cloudflare Access | public application |

The API hostnames above follow the current decision:
`api-staging.klynx.net` and `api.klynx.net`.

## Normal day-to-day flow

1. Put the finished change on `staging` and push it.
2. GitHub runs pytest and the vinext build, deploys the staging backend, and
   deploys the `staging` Worker.
3. Test the change through Cloudflare Access.
4. Open a pull request from `staging` to `main`. Use a merge commit, or
   fast-forward `main` when your branch policy permits it. Do not squash or
   rebase this promotion PR because production must identify the exact commit
   that was deployed to staging.
5. After the PR is merged, run **Promote tested commit to production** from
   the Actions tab on `main`. Leave `release_sha` empty for the normal
   promotion.
6. Approve the `production` GitHub Environment deployment. The workflow
   verifies that the selected commit exists in both `staging` and `main`,
   reruns tests, builds with production variables, and deploys it.

There are no environment-specific source edits between steps 2 and 6.

## GitHub repository setup

Create two GitHub Environments named `staging` and `production`.

Add these variables to each environment:

| Variable | Staging value | Production value |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.klynx.net` | `https://api.klynx.net` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | same account ID |
| `VPS_SSH_HOST` | VPS hostname/IP | VPS hostname/IP |
| `VPS_SSH_PORT` | normally `22` | normally `22` |
| `VPS_SSH_USER` | restricted deploy user | restricted deploy user |

Add these secrets separately to each environment:

- `CLOUDFLARE_API_TOKEN`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_KNOWN_HOSTS`
- `BACKEND_ENV`

The Cloudflare token should be scoped only to the Klynx account/zone and the
Worker/custom-domain operations needed by Wrangler. Never use a global API key.

Example staging `BACKEND_ENV`:

```dotenv
APP_ENV=staging
CORS_ALLOWED_ORIGINS=https://staging.rental-os.klynx.net
ODOO_URL=http://odoo-staging:8069
ODOO_DB=klynx_staging
ODOO_USERNAME=staging-api-user
ODOO_PASSWORD=unique-staging-secret
```

Example production `BACKEND_ENV`:

```dotenv
APP_ENV=production
CORS_ALLOWED_ORIGINS=https://rental-os.klynx.net
ODOO_URL=https://client-odoo.example.com
ODOO_DB=client_production
ODOO_USERNAME=production-api-user
ODOO_PASSWORD=unique-production-secret
```

Do not put real values in repository `.env` files.

### Protect main

Create a branch ruleset for `main`:

- require a pull request;
- require at least one approval;
- dismiss stale approvals;
- require the **Backend pytest** status check;
- preferably also require **Frontend vinext build**;
- require the branch to be up to date before merging;
- block force pushes and deletion;
- do not allow squash or rebase for the `staging` to `main` promotion.

On the `production` GitHub Environment:

- restrict deployment to protected branches;
- add a required reviewer;
- prevent self-review when the GitHub plan supports it.

The workflow itself is manual and also rejects any commit that is not present
in both `staging` and `main`, so missing environment protection cannot turn
a staging-only commit into a production deployment.

## VPS bootstrap

Install Docker Engine, the Compose plugin, Nginx, `curl`, and
`cloudflared`. Create `/opt/klynx-rental-os` and a restricted deploy user.

Install the root-owned deployment entry point once:

```bash
sudo install -o root -g root -m 0755 deploy/install-release.sh \
  /usr/local/sbin/klynx-install-release
```

Allow the deploy user to run only that installed entry point through sudo.
The GitHub workflow uploads release archives and one-time environment files to
`/tmp`; it does not upload or execute a replacement privileged script.

Install the Nginx example from `deploy/nginx/rental-os.conf.example`, test
the Nginx configuration, and reload it. Both backend ports bind to
`127.0.0.1`, so the API is reachable externally only through the tunnel.

Install `deploy/cloudflared/config.yml.example` as the tunnel configuration,
replace the tunnel UUID/credentials path, and run at least one connector.
For production resilience, run a second connector on another host when one is
available.

## Isolated staging Odoo

Staging must not reuse the production database, Postgres volume, Odoo
filestore, database password, API user, or Docker network.

On the VPS:

```bash
cp deploy/odoo-staging.env.example /etc/klynx/odoo-staging.env
sudo chmod 600 /etc/klynx/odoo-staging.env
docker compose \
  --env-file /etc/klynx/odoo-staging.env \
  -f deploy/docker-compose.odoo-staging.yml \
  up -d
```

Set `ODOO_IMAGE` to the same Odoo major version used by the target client,
then initialize a brand-new staging database. Synthetic/demo data may be
loaded, but do not restore a production backup containing client data.

The staging Odoo compose file creates dedicated
`klynx-odoo-staging-db` and `klynx-odoo-staging-data` volumes plus the
`klynx-odoo-staging` network. The staging backend joins only that network.

The production backend joins `klynx-odoo-production` by default. If the
client Odoo URL is external HTTPS, create this empty isolation network once;
if Odoo is local, attach only the production Odoo services to it.

## Cloudflare setup

Deployments use the explicit named environments in
`frontend/wrangler.jsonc`. Never run a bare production deploy command:

```bash
npx vinext-cloudflare deploy --env staging
npx vinext-cloudflare deploy --env production
```

Before exposing staging DNS, create one Cloudflare Access self-hosted
application with these two concrete hostnames:

- `staging.rental-os.klynx.net`
- `api-staging.klynx.net`

Add an Allow policy for the intended staff identity/group. Access is deny by
default, so do not add an Everyone bypass.

For the cross-origin frontend/API flow:

- turn on **Eager redirect cookie** for the multi-domain application;
- set the Access cookie SameSite behavior to None or Lax;
- for the API hostname, enable **Bypass OPTIONS requests to origin**;
- keep FastAPI CORS restricted to the staging frontend origin.

The frontend uses `credentials: "include"`, allowing the browser to send
the Access authorization cookie to the API. The OPTIONS bypass is safe here
because FastAPI still enforces the exact allowed origin; the actual API
request remains protected by Access.

Relevant Cloudflare documentation:

- https://developers.cloudflare.com/workers/wrangler/environments/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/

## Verification before first production promotion

1. Visit the staging frontend while signed out and confirm Access blocks it.
2. Sign in once and confirm frontend API calls succeed without visiting the
   API hostname manually.
3. Confirm an unapproved identity is denied.
4. Confirm `docker inspect` shows staging and production backends on
   different networks and with different environment files.
5. Create a recognizable test record in staging and confirm it does not exist
   in the production Odoo database.
6. Confirm direct connections to VPS ports 8000, 8001, and 8069 are blocked
   from the public Internet.
7. Promote to production and verify both the frontend and API health endpoint.

## Rollback

Use the same **Promote tested commit to production** workflow. Enter the full
40-character SHA of the last known-good commit in `release_sha`, approve the
production environment, and let the workflow redeploy that commit to both the
production Worker and backend.

The workflow accepts a rollback SHA only when it remains reachable from both
`staging` and `main`, and when that commit contains this deployment
infrastructure. This is intentionally a commit redeploy strategy; Cloudflare
version rollback is not used yet.

The VPS installer keeps prior release directories and automatically attempts
to restart the previous backend release if a new backend fails its health
check.
