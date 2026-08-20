# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the **developer toolkit** for AI Web Engine, a platform for building AI-powered web
applications in JavaScript. This repo is _not_ the engine itself — it holds the tooling, type
definitions, documentation, and example scripts used to build and deploy solutions that run on a
remote AI Web Engine server. Two hosts are involved: `SERVER_HOST` (default `https://softagen.com`)
is the default host for deployed solutions, while the engine's management API (`/engine/...`),
MCP endpoint (`/mcp`), authenticated GraphQL endpoint (`/graphql`) and OAuth discovery live on
`MANAGE_HOST` (default `https://manage.softagen.com`).

There is no build step and no test suite. Work here is: authoring server-side scripts under `src/`,
maintaining the Markdown docs, and running the Node CLI helpers under `scripts/`.

## Setup and common commands

```bash
npm install                       # or: make install
cp .env.example .env              # then edit SERVER_HOST etc.
make oauth-login                  # authenticate; writes schemas/token.json (required before uploads)
make fetch-types                 # refresh types/aiwebengine{,-priv}.d.ts from the server
make fetch-graphql-schema        # download GraphQL schema to schemas/schema.json
make fetch-openapi               # download OpenAPI to apis/openapi.json
make format                      # prettier --write across js/ts/json/md
make lint                        # markdownlint over **/*.md
```

Every `make` target is a thin wrapper over the matching `npm run` script; use either.

### Deploying scripts (the core workflow)

`scripts/upload-script.js` uploads a server-side script plus an optional asset directory. It reads
the OAuth token from `schemas/token.json` (run `make oauth-login` first — the token is **not** taken
from `.env`), uploads the script to `POST $MANAGE_HOST/engine/upsert_script`, then base64-uploads
each asset to `POST $MANAGE_HOST/engine/assets`. Convenience wrappers with the correct paths already
wired:

```bash
npm run upload-editor            # deploy src/editor/  (add -dry-run to preview)
npm run upload-docs              # deploy src/docs/    (add -dry-run to preview)
npm run upload-admin             # deploy src/admin/   (add -dry-run to preview)
```

Always run the `*-dry-run` variant first to see exactly what would be uploaded. To deploy something
else, call the script directly:

```bash
node scripts/upload-script.js --script-path <file> --script-uri <uri> \
  --assets-dir <dir> --asset-prefix <prefix> [--dry-run]
```

Files matching patterns in `.uploadignore` are skipped when scanning `--assets-dir`.

After deploying, bind the scripts to the host they should be published on with
`scripts/set-script-hosts.js`, which calls `POST $MANAGE_HOST/engine/script_hosts?uri=…&hosts=…`
(administrators only; `GET` reads the current binding and `DELETE` clears it):

```bash
make set-script-hosts            # admin + editor + docs → MANAGE_HOST's hostname
make set-script-hosts-dry-run    # preview
```

`--hosts` overrides the target: a comma-separated list, `*` for every configured host, or empty for
the engine's default host. Without it the script uses the host part of `MANAGE_HOST`.

## Two things that both live in `src/`, and how they differ

`src/editor/`, `src/docs/`, and `src/admin/` are each a **deployed AI Web Engine solution**, not
local Node code. Each is a single `.js` entry script (the editor and docs also ship an `assets/`
directory; admin is a single self-contained script with no assets). `src/admin/admin.js` serves the
user-role management UI at `/admin`, grouped under the "Aiwebengine administration" tag in Swagger;
the page reads and writes roles straight from the engine's HTTP API, which only answers an
administrator. They run on the server inside a sandboxed **QuickJS**
environment — not Node — so:

- No `require`/`import`, no npm packages, no Node built-ins at runtime.
- Behavior is driven by server-provided globals: `routeRegistry.registerRoute(path, handlerName,
method)`, `console`, `fetch`, etc. Handlers take a `context` and return
  `{ status, body, contentType, headers }`. See `src/docs/assets/guides/scripts.md` for the model.
- **All scripts are equal.** There is no privileged-script flag: what a call is allowed to do
  depends on the signed-in user — whether they are an Editor, an Administrator, or an owner of the
  script — and the engine enforces that.
- The legacy JavaScript globals in `types/aiwebengine-priv.d.ts` are deprecated, and every one of
  them now has an HTTP equivalent under `/engine/` — script, asset, secret and user management
  (`/engine/scripts`, `/engine/read_script`, `/engine/upsert_script`, `/engine/delete_script`,
  `/engine/assets`, `/engine/secrets`, `/engine/script_owners`, `/engine/users`,
  `/engine/user_roles`), logs (`GET|DELETE /engine/script_logs`) and route introspection
  (`/engine/routes`), with equivalent MCP tools — see `apis/openapi.json`. Prefer those endpoints;
  the browser calls them with the signed-in user's session and the engine enforces that user's
  permissions. Nothing under `src/` calls a privileged global any more.

Every script under `src/` references `types/aiwebengine.d.ts`; a script that still reached for a
privileged global would reference `types/aiwebengine-priv.d.ts` instead. Both files are
**generated** by `make fetch-types` from `/engine/types/v0.1.0/` — edit the server, not these
files.

`scripts/` is the opposite: ordinary **Node.js** CLI tooling that runs locally (CommonJS `require`,
`dotenv`, real filesystem and network access).

## Type checking

`jsconfig.json` enables `checkJs` over `src/**/*.js` — the source scripts are plain JS type-checked
via JSDoc against the `.d.ts` files. `tsconfig.json` covers `.ts/.tsx/.jsx` and configures JSX
(`h`/`Fragment` pragma) for any TypeScript/JSX authored under `src/`. There is no `tsc` npm script;
type errors surface in-editor.

## Documentation

The user-facing docs under `src/docs/assets/` (getting-started, guides, examples, reference, tools)
are the authoritative description of the platform's scripting model and APIs — consult them before
writing or changing a server-side script. They are served by `src/docs/docs.js` once deployed.

## Conventions

- 2-space indentation; run `make format` (prettier) before committing. Markdown must pass
  `make lint` (config in `.markdownlint.json`).
- Config for the local tooling comes from `.env` (see `.env.example`); `SERVER_HOST`
  (default `https://softagen.com`) and `MANAGE_HOST` (default `https://manage.softagen.com`) flow
  into every script and Makefile target. `/engine/`, `/mcp`, `/graphql` and OAuth discovery go to
  `MANAGE_HOST`. `SERVER_HOST` is the engine's _default_ host for deployed solutions — individual
  scripts can be bound elsewhere (see `make set-script-hosts`); the engine currently serves
  `softagen.com`, `manage.softagen.com` and `world.softagen.com`. `make oauth-login` discovers from
  `OAUTH_ISSUER` (defaults to `MANAGE_HOST`) and follows whatever authorization and token endpoints
  that metadata document names — `https://manage.softagen.com/auth/oauth2/*` today.
