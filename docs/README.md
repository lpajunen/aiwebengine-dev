# Solution Developer Documentation

How to build websites, APIs, MCP tools and agents on aiwebengine.

A **script** is a tree of files stored in the engine, with an entrypoint
`main.{ts,js,tsx,jsx}`. Its `init()` — which the engine calls — registers what
it publishes: routes, streams, MCP tools and prompts, scheduled jobs. Handlers
are top-level functions named by string; each receives one `context` argument
and returns a response. Files under `public/` may be served, files under
`resources/` may be MCP resources, and everything else is private to the
script.

## Getting started

1. [Your First Script](getting-started/01-first-script.md) — a route, a page, a log line
2. [Working with the Editor](getting-started/02-working-with-editor.md) — the browser-based editor at `/editor`
3. [Deployment Workflow](getting-started/03-deployment-workflow.md) — the editor, the repository tooling, git sync, and choosing what is served

## Guides

| Guide                                                       | What it covers                                          |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| [Script Development](guides/scripts.md)                     | Handlers, routes, requests and responses, state, errors |
| [Files and Assets](guides/assets.md)                        | A script's files, serving them, reading them from code  |
| [Registering Files as Routes](guides/asset-registration.md) | File routes and the `public/` directory                 |
| [Streaming](guides/streaming.md)                            | Server-Sent Events                                      |
| [MCP Tools](guides/mcp-tools.md)                            | Tools an AI client can call                             |
| [MCP Prompts](guides/mcp-prompts.md)                        | Reusable prompt templates                               |
| [Logging and Debugging](guides/logging.md)                  | Writing logs and reading them back                      |
| [AI-Assisted Development](guides/ai-development.md)         | Using the editor's assistant and other AI tools         |

## Reference

| Reference                                       | What it covers                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [JavaScript APIs](reference/javascript-apis.md) | Every global: routes, files, storage, secrets, database, scheduler, `fetch`, `ResponseBuilder` |
| [Authentication API](reference/auth-api.md)     | The request's auth context, and user and role management                                       |
| [Conversion API](reference/conversion-api.md)   | Markdown, Handlebars and base64 helpers (`convert.*`)                                          |
| [Example Scripts](examples/index.md)            | Working examples in `aiwebengine-examples`                                                     |

The authoritative types are `aiwebengine.d.ts`, served by every engine at
`/engine/types/v{version}/aiwebengine.d.ts` (`make fetch-types` saves it to
`types/`).

## A script in one screen

```javascript
// main.ts
function listItems(context) {
  const limit = Number(context.request.query.limit || 10);
  return ResponseBuilder.json({ items: [], limit });
}

function createItem(context) {
  const item = context.request.json();
  if (!item.name) return ResponseBuilder.error(400, "name is required");
  console.log(`created ${item.name}`);
  return ResponseBuilder.json(item, 201);
}

function init() {
  routeRegistry.registerRoute("/api/items", {
    handler: "listItems",
    method: "GET",
  });
  routeRegistry.registerRoute("/api/items", {
    handler: "createItem",
    method: "POST",
  });
}
```
