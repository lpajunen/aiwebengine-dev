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
from `.env`), uploads the script to `POST /upsert_script`, then base64-uploads each asset to
`POST /assets`. Convenience wrappers with the correct paths already wired:

```bash
npm run upload-editor            # deploy src/editor/  (add -dry-run to preview)
npm run upload-docs              # deploy src/docs/    (add -dry-run to preview)
```

Always run the `*-dry-run` variant first to see exactly what would be uploaded. To deploy something
else, call the script directly:

```bash
node scripts/upload-script.js --script-path <file> --script-uri <uri> \
  --assets-dir <dir> --asset-prefix <prefix> [--dry-run]
```

Files matching patterns in `.uploadignore` are skipped when scanning `--assets-dir`.

## Two things that both live in `src/`, and how they differ

`src/editor/` and `src/docs/` are each a **deployed AI Web Engine solution**, not local Node code.
Each is a single `.js` entry script plus an `assets/` directory. They run on the server inside a
sandboxed **QuickJS** environment — not Node — so:

- No `require`/`import`, no npm packages, no Node built-ins at runtime.
- Behavior is driven by server-provided globals: `routeRegistry.registerRoute(path, handlerName,
method)`, `userStorage`, `console`, `fetch`, etc. Handlers take a `context` and return
  `{ status, body, contentType, headers }`. See `src/docs/assets/guides/scripts.md` for the model.
- Privileged APIs (e.g. `userStorage` for user/role management) are only available to scripts marked
  privileged on the server; their types live in `types/aiwebengine-priv.d.ts`.

Each script starts with a `/// <reference path="../../types/aiwebengine-priv.d.ts" />` triple-slash
directive so the editor type-checks it against the platform API. The public API surface is
`types/aiwebengine.d.ts`; both files are **generated** by `make fetch-types` — edit the server, not
these files.

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
