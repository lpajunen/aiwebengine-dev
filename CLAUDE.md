# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the **developer toolkit** for AI Web Engine, a platform for building AI-powered web
applications in JavaScript. This repo is _not_ the engine itself — it holds the tooling, type
definitions, documentation, and example scripts used to build and deploy solutions that run on a
remote AI Web Engine server. Two hosts are involved: `SERVER_HOST` (default `https://softagen.com`)
is the default host for deployed solutions, while the engine's management API (`/engine/...`),
MCP endpoint (`/mcp`) and OAuth discovery live on
`MANAGE_HOST` (default `https://manage.softagen.com`).

There is no build step and no test suite. Work here is: authoring server-side scripts in the top-level script directories,
maintaining the Markdown docs, and running the Node CLI helpers under `scripts/`.

## Setup and common commands

```bash
npm install                       # or: make install
cp .env.example .env              # then edit SERVER_HOST etc.
make oauth-login                  # authenticate; writes schemas/token.json (required before uploads)
make token-status                # how long the saved token has left
make refresh-token               # renew by hand (--force to renew early)
make fetch-types                 # refresh types/aiwebengine.d.ts from the server
make fetch-openapi               # download OpenAPI to apis/openapi.json
make format                      # prettier --write across js/ts/json/md
make lint                        # markdownlint over **/*.md
```

Every `make` target is a thin wrapper over the matching `npm run` script; use either.

### Authentication

The access token lasts about an hour, but **expiry does not mean logging in again**: the tooling
scripts renew it themselves from the refresh token, so a long session is not interrupted.
`scripts/lib/token.js` holds that logic and every script goes through its `loadAccessToken()`;
`OAUTH_TOKEN` in the environment overrides the file and is used as-is.

Renewing needs the `client_id` the login registered, which `oauth_pkce_token.js` persists into
`schemas/token.json` alongside `token_endpoint` and `issuer`. A token file saved before that was
added has no `client_id` and cannot be renewed — `make oauth-login` once fixes it for good. Log in
again only when the refresh token itself is rejected; the scripts say so explicitly when that
happens.

### Deploying scripts (the core workflow)

`scripts/upload-script.js` uploads a server-side script plus an optional asset directory. It reads
the OAuth token from `schemas/token.json` (run `make oauth-login` first — the token is **not** taken
from `.env`), uploads the entrypoint to `POST $MANAGE_HOST/engine/write_file` (under its own name, `main.ts`), then the
assets through `POST $MANAGE_HOST/engine/write_files`. Convenience wrappers with the correct paths already
wired:

```bash
make upload-editor               # deploy editor/  (add -dry-run to preview)
make upload-docs                 # deploy docs/    (add -dry-run to preview)
make upload-admin                # deploy admin/   (add -dry-run to preview)
make upload-all                  # all three
```

Always run the `*-dry-run` variant first to see exactly what would be uploaded. To deploy something
else, call the script directly:

```bash
node scripts/upload-script.js --script-path <dir>/main.js --script-uri <uri> \
  --assets-dir <dir> [--dry-run]
```

The assets directory is the script's own directory. Two things under it are not assets: `main.*`,
which is the script itself, and whatever `.aiwebengineignore` excludes — the same file the engine
reads when pushing a script to a repository, so an upload and a push agree on what belongs to the
script.

After deploying, bind the scripts to the host they should be published on with
`scripts/set-script-hosts.js`, which calls `POST $MANAGE_HOST/engine/set_script_hosts` with `{script, hosts: [...]}`
(administrators only; `get_script_hosts` reads the current binding and an empty list clears it):

```bash
make set-script-hosts            # admin + editor + docs → MANAGE_HOST's hostname
make set-script-hosts-dry-run    # preview
```

`--hosts` overrides the target: a comma-separated list, `*` for every configured host, or empty for
the engine's default host. Without it the script uses the host part of `MANAGE_HOST`.

## Repository layout is the deployment contract

Every script is a **top-level directory holding `main.*`**; everything else under it is one of its
assets, at the same relative path. `docs/guides/scripts.md` is deployed as the asset
`guides/scripts.md`, and `docs/main.js` is the entrypoint rather than an asset.

This is the layout the engine's git sync (`pull_from_git`, `push_to_git`) reads and writes, which is
why there is no `src/` directory and no manifest: the URI a script is served at and who owns it
deliberately do not live in the repository. A file's asset name is its path inside the script's
directory (`mapPathToAssetName` in `docs/main.js`), so the deployed name equals the repository path.

## Shared tooling

`scripts/` and the two TypeScript configs are a verbatim copy of the same files in
`../aiwebengine-examples`, which is the source of truth.

```bash
make check-tooling    # diff against the source; fails on drift
make sync-tooling     # take the source version
```

`TOOLING_SOURCE` overrides where that is. Everything repository-specific is kept out of the shared
files: per-script defaults live in `aiwebengine.config.json` (which script `make eval` and
`make status` talk to when none is named), and the upload and host-binding targets live in the
`Makefile`, which includes the shared `scripts/tooling.mk` for everything generic.

Fix a tooling bug in `../aiwebengine-examples`, then `make sync-tooling` here.

## Scripts and tooling, and how they differ

`editor/`, `docs/`, and `admin/` are each a **deployed AI Web Engine solution**, not
local Node code. Each is a directory holding `main.js`, with every other file under it deployed as
one of that script's assets at the same relative path (admin has none). `admin/main.js` serves the
user-role management UI at `/admin`, grouped under the "Aiwebengine administration" tag in Swagger;
the page reads and writes roles straight from the engine's HTTP API, which only answers an
administrator. They run on the server inside a sandboxed **QuickJS**
environment — not Node — so:

- No npm packages and no Node built-ins at runtime. `import` does work, but only for the script's
  **own assets** — `import { x } from "./server/m.ts"` resolves `server/m.ts` against the assets of
  the same script, and anything else is an `invalid-import` diagnostic.
- Behavior is driven by server-provided globals: `routeRegistry.registerRoute(path, { handler: "handlerName", method: "GET" })`, `console`, `fetch`, etc. Handlers take a `context` and return
  `{ status, body, contentType, headers }`. See `docs/guides/scripts.md` for the model.
- **All scripts are equal.** There is no privileged-script flag: what a call is allowed to do
  depends on the signed-in user — whether they are an Editor, an Administrator, or an owner of the
  script — and the engine enforces that.
- Engine administration is not a JavaScript global. It is the engine's operation table, under
  `/engine/` — script, file, secret and user management
  (`/engine/list_scripts`, `/engine/list_files`, `/engine/read_file` (with `lines`/`grep`), `/engine/write_file`,
  `/engine/write_files`, `/engine/edit_file`, `/engine/delete_file`, `/engine/delete_script`,
  `/engine/list_secrets`, `/engine/list_script_owners`, `/engine/list_users`, `/engine/add_user_role`), logs
  (`/engine/read_logs`, `/engine/clear_logs`, plus `GET /engine/script_logs/stream` for an SSE tail), route
  introspection (`/engine/list_routes`) and the pre-deploy loop (`POST /engine/check_script`,
  `POST /engine/eval_script`, `POST /engine/run_tests`), with equivalent MCP tools — see
  `apis/openapi.json`. The browser calls them with the signed-in user's session and the engine
  enforces that user's permissions.
- The script-scoped storage global is `scriptStorage`, and together with
  `personalStorage` it implements the WHATWG `Storage` interface: `setItem`/`removeItem`/`clear`
  return nothing and throw a `DOMException` (`QuotaExceededError`, `SecurityError`) instead of
  returning a message.

Every script starts with a `/// <reference path="../types/aiwebengine.d.ts" />`
triple-slash directive. That file is **generated** by `make fetch-types` from
`/engine/types/v0.1.0/` — edit the server, not it.

`scripts/` is the opposite: ordinary **Node.js** CLI tooling that runs locally (CommonJS `require`,
`dotenv`, real filesystem and network access).

## Type checking

`jsconfig.json` enables `checkJs` over the script directories (`*/**/*.js`) — the source scripts are
plain JS type-checked via JSDoc against `types/aiwebengine.d.ts`. `tsconfig.json` covers
`.ts/.tsx/.jsx` and configures JSX (`h`/`Fragment` pragma). Both exclude `node_modules` and
`scripts`, so the Node tooling is **not** type-checked.

```bash
make typecheck                   # tsc over both configs
make verify                      # format-check + lint + typecheck
```

`make verify` is the one to run before committing; every target wraps the matching `npm run`
script.

## Documentation

The user-facing docs under `docs/` (getting-started, guides, examples, reference, tools)
are the authoritative description of the platform's scripting model and APIs — consult them before
writing or changing a server-side script. They are served by `docs/main.js` once deployed.

## Conventions

- 2-space indentation; run `make format` (prettier) before committing. Markdown must pass
  `make lint` (config in `.markdownlint.json`).
- Config for the local tooling comes from `.env` (see `.env.example`); `SERVER_HOST`
  (default `https://softagen.com`) and `MANAGE_HOST` (default `https://manage.softagen.com`) flow
  into every script and Makefile target. `/engine/`, `/mcp` and OAuth discovery go to
  `MANAGE_HOST`. `SERVER_HOST` is the engine's _default_ host for deployed solutions — individual
  scripts can be bound elsewhere (see `make set-script-hosts`); the engine currently serves
  `softagen.com`, `manage.softagen.com` and `world.softagen.com`. `make oauth-login` discovers from
  `OAUTH_ISSUER` (defaults to `MANAGE_HOST`) and follows whatever authorization and token endpoints
  that metadata document names — `https://manage.softagen.com/auth/oauth2/*` today.
