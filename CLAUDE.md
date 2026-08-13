# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the **developer toolkit** for AI Web Engine, a platform for building AI-powered web
applications in JavaScript. This repo is _not_ the engine itself — it holds the tooling, type
definitions, documentation, and example scripts used to build and deploy solutions that run on a
remote AI Web Engine server (default `https://softagen.com`, override with `SERVER_HOST`).

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
from `.env`), uploads the script to `POST /engine/upsert_script`, then base64-uploads each asset to
`POST /engine/assets`. Convenience wrappers with the correct paths already wired:

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

## Two things that both live in `src/`, and how they differ

`src/editor/`, `src/docs/`, and `src/admin/` are each a **deployed AI Web Engine solution**, not
local Node code. Each is a single `.js` entry script (the editor and docs also ship an `assets/`
directory; admin is a single self-contained script with no assets). `src/admin/admin.js` serves the
user-role management UI and API under the `/admin/` prefix, grouped under the "Aiwebengine
administration" tag in Swagger; its APIs use the privileged `userStorage` role management calls, so
the script must be marked privileged on the server. They run on the server inside a sandboxed
**QuickJS** environment — not Node — so:

- No `require`/`import`, no npm packages, no Node built-ins at runtime.
- Behavior is driven by server-provided globals: `routeRegistry.registerRoute(path, handlerName,
method)`, `console`, `fetch`, etc. Handlers take a `context` and return
  `{ status, body, contentType, headers }`. See `src/docs/assets/guides/scripts.md` for the model.
- The **privileged** JavaScript globals in `types/aiwebengine-priv.d.ts` are deprecated. Script,
  asset and secret management is now served over HTTP under `/engine/` (`/engine/scripts`,
  `/engine/read_script`, `/engine/upsert_script`, `/engine/delete_script`, `/engine/assets`,
  `/engine/secrets`, `/engine/script_owners`, `/engine/script_security_profile`,
  `/engine/set_script_privileged`, `/engine/script_logs`) — see `apis/openapi.json`. Prefer those
  endpoints; the browser calls them with the signed-in user's session and the engine enforces that
  user's permissions.
- What is still only available as a privileged global, with no HTTP equivalent: `userStorage`
  (user and role management), `console.listLogs()`/`console.pruneLogs()` (engine-wide logs), and
  `routeRegistry.listRoutes()`. Scripts using those must be marked privileged on the server —
  `src/admin/admin.js` (user roles) and `src/editor/editor.js` (logs and route listing) both are.

Scripts that still need a privileged global start with a
`/// <reference path="../../types/aiwebengine-priv.d.ts" />` triple-slash directive; the rest
reference `types/aiwebengine.d.ts`. Both files are **generated** by `make fetch-types` from
`/engine/types/v0.1.0/` — edit the server, not these files.

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
- Config for the local tooling comes from `.env` (see `.env.example`); `SERVER_HOST` flows into
  every script and Makefile target and defaults to `https://softagen.com`.
