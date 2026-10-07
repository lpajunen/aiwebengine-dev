# Script Development Guide

How to write scripts for aiwebengine: structure, handlers, routes, requests and
responses, state, and how scripts work together.

## Table of Contents

- [Script Basics](#script-basics)
- [Files and Modules](#files-and-modules)
- [Handler Functions](#handler-functions)
- [Route Registration](#route-registration)
- [Request Handling](#request-handling)
- [Response Formatting](#response-formatting)
- [State Management](#state-management)
- [Error Handling](#error-handling)
- [Scripts Working Together](#scripts-working-together)
- [Best Practices](#best-practices)

## Script Basics

### What is a Script?

A script is a tree of files stored in the engine's database. Its entrypoint is
`main.js` (or `main.ts`, `main.tsx`, `main.jsx`). A script:

- Defines handler functions for HTTP requests, MCP tools, streams and jobs
- Registers them in `init()`
- Keeps state in storage or its own database tables
- Runs in a sandboxed QuickJS runtime, with no build step: TypeScript and JSX
  are transpiled when the script loads

Its name is a slug: lower-case letters, digits, `-` and `_`.

### Minimal Script Example

```javascript
function helloHandler(context) {
  return ResponseBuilder.text("Hello, World!");
}

function init() {
  routeRegistry.registerRoute("/hello", {
    handler: "helloHandler",
    method: "GET",
  });
}
```

Handlers always receive a single `context` argument; the HTTP request lives at
`context.request`. Return responses with the `ResponseBuilder` helpers — see
[Response Formatting](#response-formatting).

### Script Lifecycle

```text
1. Files written     → every write records a revision of the script
2. init() runs       → the engine bundles the tree, runs it, and calls init();
                       registrations made there take effect
3. Requests arrive   → for each one the program runs again from the top,
                       then the registered handler is called
```

`init()` runs when the engine starts and after every write (unless the script
is pinned to an earlier revision). You never call it yourself. Because the
program runs from the top for each invocation, top-level code should only
define things — see [State Management](#state-management).

## Files and Modules

A script can be one file or many. Imports name the file exactly, extension
included:

```text
my-app/
├── main.ts             ← entrypoint: init() and the handler names
├── lib/handlers.ts     ← handler implementations
├── lib/store.ts        ← data access
├── lib/handlers.test.ts
├── skills/faq.md       ← imported as text
└── public/app.css      ← may be served by a file route
```

```typescript
// main.ts
import { listItems, addItem } from "./lib/handlers.ts";
import faq from "./skills/faq.md"; // the file's text

// Handlers are named by string and must be globals of main.ts
Object.assign(globalThis, { listItems, addItem });

function init() {
  routeRegistry.registerRoute("/my-app/items", { handler: "listItems" });
  routeRegistry.registerRoute("/my-app/items", {
    handler: "addItem",
    method: "POST",
  });
}
```

Rules worth knowing:

- `main.*` never uses `export`; modules under it do.
- A handler is either a top-level function of `main.*` or a function made
  global there with `Object.assign(globalThis, {...})`. A name that is not a
  global function is a 500 on the first request; `check_script` reports it as
  `missing-handler` before you deploy.
- `.json`, `.md` and `.txt` imports are data: you get the content, never code.
- Tests (`*.test.ts`) cannot import `main.*`, which is another reason to keep
  handlers in `lib/`.

## Handler Functions

### Handler Signature

```javascript
function handlerName(context) {
  const req = context.request;
  return ResponseBuilder.text("response content");
}
```

### Context Overview

- `request`: the HTTP request — method, path, headers, query, params, form, body
- `args`: an MCP tool's or prompt's arguments; `null` for HTTP routes
- `kind`: the invocation type (`httpRoute`, `scheduled`, `mcpTool`, etc.)
- `scriptUri` / `handlerName`: which script and handler are running
- `invocationId`: the id this invocation's log lines are filed under
- `meta`: what a scheduled job or task was given (`meta.schedule`, `meta.task`)

### Request Object (context.request)

```javascript
{
  method: "POST",
  path: "/api/users/42",
  query: { page: "1" },            // ?page=1
  params: { id: "42" },            // from "/api/users/:id"
  form: { name: "John" },          // form-encoded or multipart fields
  files: [],                       // multipart uploads, base64 in `data`
  headers: /* Headers */,          // headers.get("content-type") or headers["content-type"]
  body: "...",                     // the raw body; text() returns it, json() parses it
  auth: { isAuthenticated, userId, userEmail, userName, isEditor, isAdmin }
}
```

### Response Object

A handler returns `{ status, body?, bodyBase64?, contentType?, headers? }`,
usually built with `ResponseBuilder`.

## Route Registration

### `routeRegistry.registerRoute()`

```javascript
routeRegistry.registerRoute(path, { handler: "handlerName", method: "GET" });
routeRegistry.registerRoute(path, { stream: true, authorize: "fnName" });
routeRegistry.registerRoute(path, { file: "public/app.css" });
```

- `path` (string) - URL path starting with `/`
- `spec` (object) - exactly one of:
  - `handler` (string) - name of the handler function, with `method`
    (`"GET"` by default, or `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`)
  - `stream: true` - a Server-Sent Events stream
  - `file` (string) - a file under `public/` in the script's tree

It returns `{ ok: true }`, or `{ ok: false, reason }` when the registration
was refused, and throws when the call itself is malformed. Always read the
result: a path another script on the same host already holds is refused, and
the reason names that script. Registration only works inside `init()`.

Routes are shared by every script on a host, so give your paths a prefix of
your own (`/my-app/...`).

### Route Specificity and Matching

When several patterns match a path, the most specific wins, whatever order they
were registered in:

1. **Exact paths** first
2. **Parameterized routes** (`:param`) next
3. **Wildcard routes** (a trailing `/*`) last

Patterns are scored: each exact segment +1000, each `:param` +100, and a
wildcard −10 per level it covers. `*` works only as the last segment.

```javascript
function init() {
  routeRegistry.registerRoute("/api/scripts/*", { handler: "getScript" }); // 1990
  routeRegistry.registerRoute("/api/scripts/:name", { handler: "getByName" }); // 2100
  routeRegistry.registerRoute("/api/scripts/:name/owners", {
    handler: "manageOwners",
  }); // 3100
  routeRegistry.registerRoute("/api/scripts/search", { handler: "search" }); // exact
}

// GET /api/scripts/search        → search
// GET /api/scripts/my-script     → getByName
// GET /api/scripts/foo/owners    → manageOwners
// GET /api/scripts/foo/bar       → getScript
```

### A RESTful API

```javascript
function init() {
  routeRegistry.registerRoute("/api/users", { handler: "listUsers" });
  routeRegistry.registerRoute("/api/users", {
    handler: "createUser",
    method: "POST",
  });
  routeRegistry.registerRoute("/api/users/:id", { handler: "getUser" });
  routeRegistry.registerRoute("/api/users/:id", {
    handler: "updateUser",
    method: "PUT",
  });
  routeRegistry.registerRoute("/api/users/:id", {
    handler: "deleteUser",
    method: "DELETE",
  });
}

function getUser(context) {
  const id = context.request.params.id; // from :id
  const page = context.request.query.page || "1"; // from ?page=
  // ...
}
```

## Request Handling

### Query Parameters

```javascript
function searchHandler(context) {
  const req = context.request;
  const query = req.query.q || "";
  const page = parseInt(req.query.page || "1");
  // GET /search?q=javascript&page=2
  return ResponseBuilder.json(performSearch(query, page));
}
```

`req.searchParams` (a `URLSearchParams`) gives repeated keys with `getAll`.

### Form Data

`req.form` holds the fields of a form-encoded or multipart body:

```javascript
function createUserHandler(context) {
  const { name, email } = context.request.form;
  if (!name || !email) {
    return ResponseBuilder.error(400, "Name and email required");
  }
  // ...
  return ResponseBuilder.json({ name, email }, 201);
}
```

A browser form posting to your own script needs no CSRF token: a signed-in
state-changing request from another origin is refused before your handler runs.

### JSON Request Body

`req.json()` parses the body and throws when it is not JSON:

```javascript
function apiHandler(context) {
  let data;
  try {
    data = context.request.json();
  } catch {
    return ResponseBuilder.error(400, "Body must be JSON");
  }
  return ResponseBuilder.json({ received: data });
}
```

### Headers

```javascript
function headerHandler(context) {
  const headers = context.request.headers;
  return ResponseBuilder.json({
    userAgent: headers.get("user-agent") || "Unknown",
    hasAuth: headers.has("authorization"),
  });
}
```

### Who is calling

`req.auth` says who is signed in. `requireAuth()` returns the user or throws
for an anonymous caller — uncaught, that is a 500 — so a handler that wants to
answer 401 or redirect checks `isAuthenticated` instead:

```javascript
function profileHandler(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) {
    return ResponseBuilder.redirect("/auth/login?redirect=/my-app/profile");
  }
  return ResponseBuilder.json({ id: auth.userId, name: auth.userName });
}
```

The engine knows three roles (editor, administrator, and everyone else). What a
person may do inside your app — members, owners, moderators — is your script's
own data, decided from `auth.userId`.

## Response Formatting

### Response Builders

```javascript
return ResponseBuilder.json({ users: ["Alice", "Bob"] }); // 200, application/json
return ResponseBuilder.json({ error: "Not found" }, 404);
return ResponseBuilder.text("Hello, World!"); // text/plain
return ResponseBuilder.html("<h1>Welcome</h1>"); // text/html
return ResponseBuilder.error(400, "Invalid input"); // {"error": "..."} as JSON
return ResponseBuilder.noContent(); // 204
return ResponseBuilder.redirect("/new-location"); // 302
```

A response is an object of the shape `{ status, body, contentType, headers }`,
and you can return that directly when the builders don't cover it — a custom
`Content-Type`, extra `headers`, or a binary `bodyBase64`:

```javascript
return {
  status: 200,
  body: css,
  contentType: "text/css",
  headers: { "Cache-Control": "max-age=3600" },
};
```

### HTML with JSX

A `.tsx` or `.jsx` file renders JSX to HTML strings on the server:

```tsx
function Greeting(props: { name: string }) {
  return <p>Hello {props.name}</p>;
}

function pageHandler(context: HandlerContext) {
  return ResponseBuilder.html(
    <main>
      <h1>Dashboard</h1>
      <Greeting name="aiwebengine" />
    </main>,
  );
}
```

## State Management

**Variables do not survive between requests.** Each invocation runs the
program from the top, so `let counter = 0` at the top level is `0` again on the
next request, and the next request may be served by another instance of a
cluster anyway. Keep state in one of these:

| Store             | Scope                                | Good for                                         |
| ----------------- | ------------------------------------ | ------------------------------------------------ |
| `scriptStorage`   | The script, shared by every user     | Settings, small caches, a value one writer owns  |
| `personalStorage` | One signed-in user within the script | Preferences, drafts, per-person notes            |
| `database`        | The script's own tables              | Anything many people change, lists, queries      |
| `secretStorage`   | The script, or one user              | API keys — used as `{{secret:NAME}}`, never read |

### Key-value storage

Both stores follow the browser `Storage` interface; values are strings of at
most 1 MB.

```javascript
function incrementHandler(context) {
  const count = parseInt(scriptStorage.getItem("counter") ?? "0") + 1;
  scriptStorage.setItem("counter", String(count));
  return ResponseBuilder.json({ counter: count });
}
```

Two requests can read and write the same key at the same time, so a counter
many people change can lose updates. Use a database table for those.

### Database tables

```javascript
function init() {
  database.ensureTable("items", {
    columns: [
      { name: "owner", type: "text" },
      { name: "title", type: "text" },
      { name: "done", type: "boolean", default: "false" },
    ],
  });
  routeRegistry.registerRoute("/my-app/items", { handler: "listItems" });
  routeRegistry.registerRoute("/my-app/items", {
    handler: "addItem",
    method: "POST",
  });
}

function listItems(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return ResponseBuilder.error(401, "Sign in");
  return ResponseBuilder.json(
    database.query("items", { where: { owner: auth.userId }, limit: 100 }),
  );
}

function addItem(context) {
  const auth = context.request.auth;
  if (!auth.isAuthenticated) return ResponseBuilder.error(401, "Sign in");
  const { title } = context.request.json();
  if (!title) return ResponseBuilder.error(400, "title is required");
  const row = database.insert("items", { owner: auth.userId, title });
  return ResponseBuilder.json(row, 201);
}
```

`database.transaction(fn)` groups writes, and `query(..., { forUpdate: true })`
inside one stops two requests from acting on the same read. See the API
reference.

### Caching an upstream call

Cache in storage, with the time it was fetched:

```javascript
const CACHE_TTL_MS = 60000;

function getRates() {
  const cached = JSON.parse(scriptStorage.getItem("rates") ?? "null");
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const response = fetch("https://api.example.com/rates");
  if (!response.ok) throw new Error(`Upstream answered ${response.status}`);
  const data = response.json();
  scriptStorage.setItem("rates", JSON.stringify({ at: Date.now(), data }));
  return data;
}
```

## Error Handling

### Try-Catch Pattern

A handler that throws answers 500 and the error is logged. Catch what you can
answer better:

```javascript
function riskyHandler(context) {
  try {
    const data = context.request.json();
    return ResponseBuilder.json({ result: processData(data) });
  } catch (error) {
    console.error(`riskyHandler: ${error.message}`);
    return ResponseBuilder.error(500, "Internal server error");
  }
}
```

### Validation

```javascript
function createItemHandler(context) {
  const form = context.request.form;
  if (!form.name) return ResponseBuilder.error(400, "Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || "")) {
    return ResponseBuilder.error(400, "Invalid email format");
  }
  if (form.name.length > 100) {
    return ResponseBuilder.error(400, "Name too long (max 100 characters)");
  }
  // ...
}
```

### Limits

Each invocation has a wall-clock budget (10 s for a request by default) and a
memory limit; `init()` has its own budget. The exact numbers for an engine are
in its `/engine/openapi.json`, under `x-aiwebengine-limits`. Work in small
steps and answer with an error rather than loop.

## Scripts Working Together

Every script has its own storage, tables and secrets; one script cannot read
another's. To use another script, go through what it publishes.

**1. Its MCP tools, with `tools`** — the usual way. The tool runs as the
person making the request, with their permissions:

```javascript
function dashboardHandler(context) {
  const open = tools.call(
    "backlog_list",
    { status: "open" },
    { readOnly: true },
  );
  return ResponseBuilder.json({ open });
}
```

`tools.list(area?)` lists what is reachable. An anonymous request, `init()` and
a scheduled job cannot call tools: there is nobody to act as.

**2. Its HTTP routes, with `fetch`** — for a public API the other script
serves. `fetch` reaches public hosts only, so call the engine's public URL,
and the request carries no session of the person you are serving.

**3. Server-Sent Event streams** — for pushing updates to browsers. A script
broadcasts on its own streams with `routeRegistry.sendStreamMessage(path, data)`.

| Method       | Use when                                 | Runs as            |
| ------------ | ---------------------------------------- | ------------------ |
| `tools.call` | You need another script's data or action | The calling person |
| `fetch`      | The other script has a public HTTP API   | Anonymous          |
| SSE streams  | Browsers need live updates               | —                  |

## Best Practices

1. **Prefix your paths** (`/my-app/...`); routes are shared per host.
2. **Validate every input** and answer 400 with a reason.
3. **Keep handlers in `lib/`** and make them global in `main.*`, so tests can
   import them.
4. **Write tests** as `*.test.ts` files and run them with `run_tests` (or
   `make test`).
5. **Check before deploying**: `check_script` runs `init()` without publishing
   anything and reports missing handlers and refused routes.
6. **Log what you will want to know** when a handler fails; `console.error`
   for failures.
7. **Never put a key in a file**: store it as a secret and use
   `{{secret:NAME}}` in `fetch` headers.

## Next Steps

- **[Asset Management](assets.md)** - Work with static files
- **[Logging Guide](logging.md)** - Debug and monitor scripts
- **[AI Development](ai-development.md)** - Use AI to generate scripts
- **[API Reference](../reference/javascript-apis.md)** - Complete API documentation
- **[Examples](../examples/index.md)** - See real-world patterns

## Quick Reference

```javascript
function myHandler(context) {
  const req = context.request;
  try {
    const param = req.query.param || req.form.param;
    if (!param) return ResponseBuilder.error(400, "Missing parameter");
    return ResponseBuilder.json({ result: process(param) });
  } catch (error) {
    console.error(`myHandler: ${error.message}`);
    return ResponseBuilder.error(500, "Internal error");
  }
}

function init() {
  routeRegistry.registerRoute("/my-app/endpoint", { handler: "myHandler" });
}
```
