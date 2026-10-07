# AI-Assisted Development Guide

aiwebengine is built to be developed with AI. There are three ways to do it,
from most to least capable:

| Way                                      | Good for                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| An AI coding agent over MCP              | Real work: multi-file scripts, tests, debugging from logs        |
| `aiwebengine-agent` (**Build a script**) | Small sites, tools and agents built from a prompt in the browser |
| The editor's AI Assistant                | Explaining and changing the script open in `/editor`             |

## An AI Coding Agent over MCP

The engine's management host serves its operations as MCP tools at `/mcp`:
`write_files`, `edit_file`, `read_file`, `search_files`, `check_script`,
`run_tests`, `eval_script`, `read_logs`, revisions, deployments, secrets and
git sync. An agent such as Claude Code connected there has the whole loop a
developer has, with your permissions and no more.

```bash
claude mcp add --transport http my-engine https://manage.example.com/mcp
```

The first use opens a browser to sign in. Then point the agent at the short
introduction it should read first:

```text
Read https://manage.example.com/engine/types/v0.1.0/script-primer.md, then
build a script "todo" with a JSON API at /todo/api/items backed by a database
table, a page at /todo, and tests. Check it with check_script and run_tests
before telling me it is done.
```

The loop that works:

1. **Write as one change** with `write_files` — the answer carries a `check`
   report, so mistakes surface immediately.
2. **Test** with `*.test.ts` files and `run_tests`.
3. **Debug from the log**: `read_logs` filtered by `request_id`, `kind` or
   `route`; `eval_script` to inspect state in the script's sandbox without
   changing anything.
4. **Stage changes on a live script** by pinning it (`deploy_script` with the
   serving revision), writing freely, and deploying head when it passes.
   `revert_script` puts back an earlier revision.

The full API is `aiwebengine.d.ts`, served beside the primer.

## aiwebengine-agent: Build a Script

If the engine runs [`aiwebengine-agent`](https://github.com/lpajunen/aiwebengine-agent),
its page (`/agent`) has a **Build a script** box. Describe a small site, MCP
tool or single-purpose agent; it starts from a template, writes the files,
checks and tests them, and asks you before anything is served. It needs your
own Anthropic API key, the editor role, and a grant you give on the engine's
consent page. When it cannot finish, it writes a handoff note to give to a
developer.

## The Editor's AI Assistant

The panel at the bottom of `/editor` sends your prompt with the selected
script or file. It answers with an explanation, or a proposed change shown as
a diff to **Apply** or **Reject**. It needs an Anthropic API key stored as the
secret `anthropic_api_key` on the `editor` script.

## Writing Effective Prompts

**Be specific about behaviour, paths and data.**

```text
Create a newsletter signup:
- GET /news/signup shows a form with an email field
- POST /news/signup validates the email, stores it in a database table
  with a unique index, and answers 400 for a bad or duplicate address
- Rate-limit signups to 5 per 10 minutes per caller
```

**Name the engine's idioms** when a model drifts toward Node.js or the browser:

```text
Use routeRegistry.registerRoute in init(), ResponseBuilder for responses,
database.ensureTable / insert / query for storage, and fetch with
{{secret:API_KEY}} in a header for the external API. No npm packages.
```

**Break large requests into steps**, each checked and tested before the next:
the product list, then the detail page, then the cart.

**Paste the error** from `read_logs` when asking for a fix.

## What the Engine Gives an App, and What It Does Not

Tell a model this up front and it will not invent APIs:

- **Has**: HTTP routes, file routes for `public/`, SSE streams, MCP tools,
  prompts and resources, scheduled jobs and durable tasks, `database` tables
  with transactions, key-value storage, per-person storage, secrets used by
  `fetch`, outbound `fetch` and MCP clients, rate limits, an audit log, JSX on
  the server, sign-in (OAuth or local accounts) handled by the engine at
  `/auth/login`.
- **Does not have**: npm packages (a script imports only its own files), an
  event loop (`fetch` returns when the response is complete; no `setTimeout`),
  sending email, password hashing — the engine signs people in, so a script
  never stores passwords — or a way to hold state in variables between
  requests.

## Using a Chat Assistant Without MCP

Give it the primer and the type definitions as context — both are served by
the engine:

```text
I write scripts for aiwebengine. The rules are in this primer:
<paste /engine/types/v0.1.0/script-primer.md>
The full API is this TypeScript declaration file:
<paste or attach /engine/types/v0.1.0/aiwebengine.d.ts>

Write a script that ...
```

Then check the result with `check_script` (or `make check-head`) before
trusting it.

## Troubleshooting AI Output

| Problem                                   | Tell the model                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| It imports npm packages or uses Node APIs | "No packages or Node.js APIs; only the globals in aiwebengine.d.ts."                 |
| It keeps state in a module variable       | "Variables do not survive between requests; use database or scriptStorage."          |
| It registers routes at the top level      | "Register only inside init(); the engine calls init()."                              |
| A handler 500s on the first request       | "Handlers must be global functions of main.*; check_script reports missing-handler." |
| It uses `await fetch(...).then`           | "fetch returns the finished response; call .json() directly."                        |
| It writes its own login                   | "Use context.request.auth and redirect to /auth/login."                              |

## Next Steps

- **[Your First Script](../getting-started/01-first-script.md)**
- **[Deployment Workflow](../getting-started/03-deployment-workflow.md)** - Checks, tests, pins
- **[Script Development](scripts.md)** - How scripts are structured
- **[API Reference](../reference/javascript-apis.md)**
