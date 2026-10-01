# JavaScript APIs Reference

This page provides a complete reference for the JavaScript APIs available in aiwebengine scripts. These functions and objects allow you to handle HTTP requests, generate responses, log information, and interact with the server environment.

## Unified Handler Context

Every handler/resolver now receives a single `context` object. For HTTP routes you usually alias `context.request` to the familiar `req` variable:

```javascript
function myHandler(context) {
  const req = context.request;

  // Access req.method, req.path, req.query, req.form, req.headers, req.body
  // Use context.args, context.invocationType, context.metadata as needed
}
```

The examples below follow this pattern—code snippets declare `const req = context.request;` when they need request data. If a snippet still shows `req`, it assumes this alias exists.

Two fields say what kind of run this is and identify it:

- `context.kind` (and its older name `context.invocationType`) is one of
  `httpRoute`, `streamCustomization`, `init`, `scheduled`, `mcpTool`,
  `mcpPrompt`, `test` or `eval`.
- `context.invocationId` identifies this invocation. Every log line the handler
  writes is filed under it, so
  `GET /engine/script_logs?request_id=<invocationId>` returns exactly the lines
  this run produced. For an HTTP route it is the request's `x-request-id`,
  which the response carries back to the caller — which is how a failing
  request in a browser leads straight to its server-side log.

## Route Registry

The `routeRegistry` object provides all HTTP route and streaming functionality in a unified namespace.

### routeRegistry.registerRoute(path, spec)

Publishes a path. The spec says what the path leads to — exactly one of
`handler`, `stream` or `file`:

| spec                                   | what the path leads to                                    |
| -------------------------------------- | --------------------------------------------------------- |
| `{ handler: "fnName", method: "GET" }` | a handler function; `method` defaults to `"GET"`          |
| `{ stream: true, authorize: "fn" }`    | a Server-Sent Events stream; `authorize` is optional      |
| `{ file: "public/app.css" }`           | a file of the script's tree; only `public/` may be served |

Every kind may also carry `summary`, `description` and `tags` for the OpenAPI
document. A handler route may carry `parameters` (an array) and `requestBody`
(an object) — objects, not JSON strings. Streams and files may carry
`authorize`, naming the function that decides who may connect or read; it
answers `{ deny: 403, reason }` to refuse, or for a stream the filter
criteria `sendStreamMessageFiltered` matches against. A handler decides for
itself, so a handler spec takes no `authorize`.

`:param` and a trailing `/*` work for all three.

**Returns:** `{ ok: true }`, or `{ ok: false, reason }` when the registration
was refused — a file outside `public/` or not in the tree, or any call made
outside `init()`. A mistake in the call throws: a spec naming no target or
two, an unknown key, a path not starting with `/`, a reserved path, a
capability you do not hold.

**Example:**

```javascript
function getUsers(context) {
  return ResponseBuilder.json({ users: [] });
}

function mayWatch(context) {
  if (!context.request.auth.isAuthenticated) return { deny: 401 };
  return { user_id: context.request.auth.userId };
}

function init() {
  routeRegistry.registerRoute("/api/users", { handler: "getUsers" });
  routeRegistry.registerRoute("/api/users/:id", {
    handler: "updateUser",
    method: "PUT",
    parameters: [{ name: "id", in: "path", required: true }],
  });
  routeRegistry.registerRoute("/notifications", {
    stream: true,
    authorize: "mayWatch",
  });
  routeRegistry.registerRoute("/styles/main.css", {
    file: "public/main.css",
  });
}
```

**Notes:**

- Registration only takes effect inside `init()`.
- Multiple clients can connect to the same stream.
- A file route serves the file as it is now: rewriting the file needs no
  redeploy.

### routeRegistry.sendStreamMessage(path, data)

Sends a message to all clients connected to a specific stream path.

**Parameters:**

- `path` (string): Stream path to send to (must start with `/`)
- `data` (object): Data object to send (will be JSON serialized)

**Returns:** `{ delivered, connections, failed }` — how many connections the
message reached, how many were open, and how many could not be written to. A
stream nobody is connected to answers `{ delivered: 0, connections: 0 }`; a
failure throws.

**Example:**

```javascript
function notifyHandler(context) {
  // Send notification to specific stream
  routeRegistry.sendStreamMessage("/notifications", {
    type: "notification",
    message: "New update available",
    timestamp: new Date().toISOString(),
    priority: "high",
  });

  return { status: 200, body: "Notification sent" };
}

// Register the handler
routeRegistry.registerRoute("/notify", {
  handler: "notifyHandler",
  method: "POST",
});
```

**Real-time Chat Example:**

```javascript
// Register a chat stream
routeRegistry.registerRoute("/chat", { stream: true });

function sendMessage(context) {
  const req = context.request;
  const { user, message } = req.form;

  if (!user || !message) {
    return { status: 400, body: "Missing user or message" };
  }

  // Send to the chat stream
  routeRegistry.sendStreamMessage("/chat", {
    type: "chat_message",
    user: user,
    message: message,
    timestamp: new Date().toISOString(),
  });

  return { status: 200, body: "Message sent" };
}

routeRegistry.registerRoute("/chat/send", {
  handler: "sendMessage",
  method: "POST",
});
```

### routeRegistry.sendStreamMessageFiltered(path, data, filter, matchMode)

Sends a message to specific connections on a stream based on metadata filtering. This enables personalized broadcasting to subsets of users on stable endpoints.

**Parameters:**

- `path` (string): Stream path to send to (must start with `/`)
- `data` (object): Data object to send (will be JSON serialized)
- `filter` (object): string values matched against what each connection's
  `authorize` function returned; omit it to reach every connection
- `matchMode` (string, optional): `"subset"` (default) — every filter entry
  must match — or `"overlap"`, where any one may

**Returns:** `{ delivered, connections, failed }`, as `sendStreamMessage`

**Example:**

```javascript
// Send to connections where metadata.room == "general"
routeRegistry.sendStreamMessageFiltered(
  "/chat",
  {
    type: "room_message",
    message: "Hello room!",
    timestamp: new Date().toISOString(),
  },
  { room: "general" },
);

// Send to specific user by ID
routeRegistry.sendStreamMessageFiltered(
  "/notifications",
  {
    type: "personal",
    message: "You have a new message",
  },
  { user_id: "user123" },
);
```

### Listing what is registered

Use the engine's HTTP API at `GET /engine/routes`, which returns every
registration in the engine — script routes, SSE streams and asset routes —
as `{host, routes}`:

```javascript
const { routes } = await (await fetch("/engine/routes")).json();

routes.forEach((route) => {
  // method is the HTTP method for handlers, or "STREAM" / "ASSET"
  console.log(`${route.method} ${route.path} -> ${route.handler}`);
});
```

Each entry carries `path`, `method`, `handler`, `script_uri`, `summary`,
`description` and `tags`. Pass `?host=...` to see only what is live on one
host; the listing is unfiltered by default, since the management host need not
be a host scripts publish on.

> **Removed globals:** `routeRegistry.listRoutes()`, `listStreams()` and
> `listAssets()` no longer exist in the sandbox — calling one is a
> `TypeError`. `/engine/routes` replaces the first two (and, unlike them,
> filters by host and reports the handler, summary, description and tags for
> stream entries); `files.list()` or `GET /engine/assets` replaces the
> third.

## Files

`files` is the running script's own tree, by path: its modules, its
`public/` files, its data. Every script reaches only its own files.

```javascript
files.list(); // [{ path, size, mimetype, createdAt, updatedAt }], sorted by path
files.read("skills/refund.md"); // text, or null if there is no such file
files.read("public/logo.png", { encoding: "base64" }); // binary, as base64
files.write("notes/today.md", "# Today"); // create or replace
files.write("public/logo.png", pngBase64, { encoding: "base64" });
files.delete("notes/today.md"); // true, or false if it was not there
```

Failures throw: a capability the caller does not hold, a path containing
`..`, content over 10,000,000 bytes, a file that is not text read without
`{ encoding: "base64" }`. A missing file is not a failure — `read` answers
`null` and `delete` answers `false`.

The entrypoint (`main.*`) is not writable through `files`;
`engine.call("write_file", ...)` is the deliberate way to change a script's
program. A write is recorded as a revision of the script.

### files.list()

**Returns:** an array of `{ path, size, mimetype, createdAt, updatedAt }`,
sorted by path. Times are milliseconds since the epoch.

### files.read(path, options?)

**Returns:** the file as UTF-8 text, or as base64 with
`{ encoding: "base64" }`; `null` when there is no such file.

For content that only changes with a redeploy, an import is better than a
read: `import policy from "./skills/refund.md"` resolves once, is cached with
the program and is pinned by the revision. `files.read` is for content the
script writes, or that changes under it.

### files.write(path, content, options?)

`content` is text, or base64 with `{ encoding: "base64" }`. The MIME type is
inferred from the extension unless `{ mimetype }` is given. A file under
`public/` can then be served with a file route:
`routeRegistry.registerRoute("/logo.png", { file: "public/logo.png" })`.

### files.delete(path)

**Returns:** `true` when a file was removed, `false` when there was none.

### Example

```javascript
function notesHandler(context) {
  const req = context.request;
  const name = req.params.name;
  const path = "notes/" + name + ".md";

  if (req.method === "GET") {
    const text = files.read(path);
    return text === null
      ? ResponseBuilder.error(404, "No such note")
      : ResponseBuilder.text(text);
  }
  if (req.method === "PUT") {
    files.write(path, req.body);
    return ResponseBuilder.text("saved");
  }
  if (req.method === "DELETE") {
    return files.delete(path)
      ? ResponseBuilder.text("deleted")
      : ResponseBuilder.error(404, "No such note");
  }
  return ResponseBuilder.error(405, "Method not allowed");
}

function init() {
  for (const method of ["GET", "PUT", "DELETE"]) {
    routeRegistry.registerRoute("/notes/:name", {
      handler: "notesHandler",
      method,
    });
  }
}
```

### Security

- Reading takes `ReadAssets`, writing `WriteAssets`, deleting `DeleteAssets`
- A path may not contain `..` or `\`, so a script cannot name another's file
- Content is limited to 10,000,000 bytes
- Writes and removals are audited and recorded as revisions

## Console Logging

### console.log(message)

Writes a message to the server log for debugging and monitoring.

**Parameters:**

- `message` (string): Message to log

**Example:**

```javascript
function myHandler(context) {
  const req = context.request;
  console.log("Handler called with path: " + req.path);
  return {
    status: 200,
    body: "Logged",
    contentType: "text/plain; charset=UTF-8",
  };
}
```

## Storage APIs

Two globals give a script persistent key-value storage, and both implement the
WHATWG `Storage` interface — the same one a browser exposes as `localStorage`
and `sessionStorage`:

- **`scriptStorage`** belongs to the script and is shared by everyone using it,
  across every instance in a cluster.
- **`personalStorage`** belongs to one authenticated user within one script.

Everything below is true of both; only the scope differs.

Keys and values are coerced with `String()`, so `setItem("count", 1)` stores
`"1"`. The mutating methods return nothing — **failures throw a `DOMException`**
rather than returning an error string:

| Error name           | When                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `QuotaExceededError` | The value exceeds 1 MB                                                                        |
| `SecurityError`      | The store is not available to the caller — most often `personalStorage` with nobody logged in |

```javascript
try {
  personalStorage.setItem("theme", "dark");
} catch (e) {
  if (e.name === "SecurityError") {
    // nobody is logged in
  }
}
```

> **Renamed:** the shared store used to be called `sharedStorage`. That name is
> gone; use `scriptStorage`.

### Storage.getItem(key)

Retrieves a value from the store.

**Parameters:**

- `key` (string): Storage key

**Returns:** String value, or `null` if the key does not exist

**Example:**

```javascript
function getCounter(context) {
  const count = scriptStorage.getItem("counter") ?? "0";
  return {
    status: 200,
    body: `Counter: ${count}`,
    contentType: "text/plain; charset=UTF-8",
  };
}
```

### Storage.setItem(key, value)

Stores a key-value pair, replacing any existing value for that key.

**Parameters:**

- `key` (string): Storage key (cannot be empty)
- `value` (string): Value to store (max 1 MB)

**Returns:** Nothing. Throws a `DOMException` when the write cannot be made.

**Example:**

```javascript
function incrementCounter(context) {
  const count = parseInt(scriptStorage.getItem("counter") ?? "0");
  const newCount = count + 1;
  scriptStorage.setItem("counter", String(newCount));
  return {
    status: 200,
    body: `New count: ${newCount}`,
    contentType: "text/plain; charset=UTF-8",
  };
}
```

### Storage.removeItem(key)

Removes a key-value pair. Removing a key that was never set is not an error.

**Parameters:**

- `key` (string): Storage key to remove

**Returns:** Nothing

**Example:**

```javascript
function resetCounter(context) {
  scriptStorage.removeItem("counter");
  return {
    status: 200,
    body: "Counter reset",
    contentType: "text/plain; charset=UTF-8",
  };
}
```

### Storage.clear()

Removes every key in the store — for `scriptStorage` the script's whole store,
for `personalStorage` only the current user's keys in this script.

**Returns:** Nothing

**Example:**

```javascript
function clearAllData(context) {
  scriptStorage.clear();
  return {
    status: 200,
    body: "Script storage cleared",
    contentType: "text/plain; charset=UTF-8",
  };
}
```

### Storage.length and Storage.key(index)

`length` is how many keys the store holds; `key(index)` returns the key at that
position, or `null` when the index is out of range. Together they enumerate a
store:

```javascript
function dumpStorage(context) {
  const entries = {};
  for (let i = 0; i < scriptStorage.length; i++) {
    const key = scriptStorage.key(i);
    if (key !== null) entries[key] = scriptStorage.getItem(key);
  }
  return ResponseBuilder.json(entries);
}
```

### Named access

Both stores also support the property access a browser allows — `store.foo`,
`"foo" in store`, `delete store.foo`, `Object.keys(store)`:

```javascript
scriptStorage.theme = "dark"; // same as setItem("theme", "dark")
const theme = scriptStorage.theme; // same as getItem("theme")
delete scriptStorage.theme; // same as removeItem("theme")
```

Convenient, but every one of those is a database round trip, so enumerating a
large store with `Object.keys()` costs one query per key. Prefer `getItem` /
`setItem` in hot paths.

### personalStorage and authentication

`personalStorage` needs a signed-in user. With nobody logged in the store is
not available to the caller and raises a `SecurityError`, so guard on
`req.auth.isAuthenticated` (or catch the error) around both reads and writes:

```javascript
function getUserPreference(context) {
  const req = context.request;
  if (!req.auth.isAuthenticated) {
    return ResponseBuilder.json({ theme: "light" });
  }
  const theme = personalStorage.getItem("theme") ?? "light";
  return ResponseBuilder.json({ theme });
}

function saveUserPreference(context) {
  const req = context.request;
  if (!req.auth.isAuthenticated) {
    return ResponseBuilder.error(401, "Authentication required");
  }
  personalStorage.setItem("theme", req.form.theme || "light");
  return ResponseBuilder.text("Preference saved");
}
```

**Use Cases for personalStorage:**

- User preferences (theme, language, display settings)
- Shopping cart contents
- Form draft data
- User-specific cache
- Per-user feature flags
- Personalized recommendations data

**Security Notes:**

- User ID is handled transparently by the engine - scripts never see user IDs directly
- Each user can only access their own data
- Data persists across sessions when PostgreSQL is configured
- Unauthenticated requests cannot access personal storage

## Secret Storage API

The global `secretStorage` object manages secrets (API keys, tokens, passwords)
scoped to the current script. Secrets are encrypted at rest and are never
returned in plaintext — you check whether one exists and reference its value in
outbound `fetch` requests with the `{{secret:KEY}}` / `{{KEY}}` injection syntax
(see the HTTP Fetch section below).

Secrets live at two levels for a script:

- **Script secrets** — shared by everyone using the script.
- **User secrets** — set by an authenticated user, take precedence over the
  script-level value for that user.

Write operations (`setSecret`, `removeSecret`, `clear`) require an authenticated
user and operate on that user's secrets.

### secretStorage.exists(key)

Returns `true` if the secret exists. Checks the authenticated user's secrets
first, then falls back to the script-level secret.

```javascript
function callApiHandler(context) {
  if (!secretStorage.exists("WEATHER_API_KEY")) {
    return ResponseBuilder.error(400, "WEATHER_API_KEY is not configured");
  }

  // The value is injected server-side; it never appears in the script.
  const response = fetch("https://api.example.com/weather", {
    headers: { Authorization: "Bearer {{secret:WEATHER_API_KEY}}" },
  });

  return ResponseBuilder.json(JSON.parse(response).body);
}
```

### secretStorage.setSecret(key, value)

Stores a secret for the authenticated user (max 1 MB). Returns a success
message, or a string starting with `Error` if the request is unauthenticated or
validation fails.

```javascript
function saveTokenHandler(context) {
  const req = context.request;
  const token = req.form.token;

  const result = secretStorage.setSecret("USER_API_TOKEN", token);
  if (result.startsWith("Error")) {
    return ResponseBuilder.error(400, result);
  }

  return ResponseBuilder.json({ message: "Token saved" });
}
```

### secretStorage.removeSecret(key)

Removes a single secret for the authenticated user. Returns `true` if it existed
and was removed, `false` otherwise.

```javascript
secretStorage.removeSecret("USER_API_TOKEN");
```

### secretStorage.clear()

Removes all secrets for the authenticated user in the current script. Returns a
success message, or a string starting with `Error` if unauthenticated.

```javascript
secretStorage.clear();
```

**Cross-script management:** the `secretStorage` global only reaches the current
script's secrets. To manage the secrets of _other_ scripts — what tools like the
editor's Secrets tab do — use the engine's HTTP API at `/engine/secrets`, or the
equivalent MCP tools. The engine allows those calls for Administrators and for
owners of the target script, and refuses everyone else. See the OpenAPI
description at `/engine/openapi.json` for the full contract.

## Database API

The global `database` object provides script-scoped table management, CRUD helpers, transactions, and lease coordination.

Every `database` call answers with the same three-way value a `fetch` response
has, so the shape does not depend on which host API produced it:

```javascript
database.query("tasks").json(); // parsed, no await
(await database.query("tasks")).json(); // awaitable, like a fetch response
JSON.parse(database.query("tasks")); // the raw JSON string, as before
```

`await` is sequencing sugar — the call has already finished by the time it
returns — and the older `JSON.parse(...)` form keeps working, so `.json()` is a
convenience rather than a migration.

### Common table operations

- `database.createTable(tableName)` creates a script-owned table namespace.
- `database.ensureTable(tableName, schemaJson)` brings a table to the shape you describe, whatever shape it is in now — the idempotent form of `createTable` plus a run of `add*Column` plus `addUniqueIndex`.
- `database.addIntegerColumn(tableName, columnName, nullable?, defaultValue?)`, `database.addBigintColumn(...)`, `database.addFloatColumn(...)`, `database.addTextColumn(...)`, `database.addBooleanColumn(...)`, `database.addTimestampColumn(...)`, and `database.addReferenceColumn(...)` extend the schema.
- `database.dropColumn(tableName, columnName)` and `database.dropTable(tableName)` remove schema objects owned by the current script.

`ensureTable` is the one to reach for in `init()`, which runs on every instance
and every restart. Each step is checked before it is attempted rather than
attempted and forgiven, so a table that is already correct costs one query and
reports that it changed nothing — and an error means something other than
"already done". The whole convergence runs under one lock keyed on the script
and table, so a cold start where every instance's first write arrives at once
takes turns instead of racing. Columns default to nullable, since a column
added to a table that already holds rows cannot be `NOT NULL` without a
default:

```javascript
function init(context) {
  const result = database
    .ensureTable(
      "tasks",
      JSON.stringify({
        columns: [
          { name: "title", type: "text" },
          { name: "completed", type: "boolean", default: "false" },
          { name: "created_at", type: "timestamp" },
        ],
        uniqueIndexes: [["title"]],
      }),
    )
    .json();
  // First run:      {success: true, created: true, columnsAdded: [...], ...}
  // Every run after: {success: true, created: false, columnsAdded: [], ...}

  return { success: true };
}
```

`type` is one of `integer`, `bigint`, `float`, `text`, `boolean` or
`timestamp`. The step-by-step equivalent:

```javascript
function init(context) {
  database.createTable("tasks");
  database.addTextColumn("tasks", "title", false);
  database.addBooleanColumn("tasks", "completed", false, "false");
  database.addTimestampColumn(
    "tasks",
    "created_at",
    false,
    "CURRENT_TIMESTAMP",
  );

  return { success: true };
}
```

### Querying and mutations

- `database.query(tableName, filters?, limit?, orderBy?, orderDir?)` returns a JSON string array of matching rows.
- `database.insert(tableName, dataJson)`, `database.update(tableName, id, dataJson)`, and `database.delete(tableName, id)` perform row-level CRUD.
- `database.upsert(tableName, keyColumnsJson, dataJson)` performs atomic insert-or-update when the conflict target has a unique index.
- `database.deleteWhere(tableName, filtersJson)` removes multiple rows using the same filter syntax as `query()`.

```javascript
function createTask(context) {
  const req = context.request;
  const result = database
    .insert(
      "tasks",
      JSON.stringify({ title: req.form.title, completed: false }),
    )
    .json();

  if (result.error) {
    return ResponseBuilder.error(400, result.error);
  }

  return ResponseBuilder.json(result, 201);
}

function listOpenTasks(context) {
  const rows = database
    .query(
      "tasks",
      JSON.stringify({ completed: false }),
      100,
      "created_at",
      "desc",
    )
    .json();

  return ResponseBuilder.json(rows);
}
```

### Transactions and leases

- `database.beginTransaction(timeout_ms?)`, `database.commitTransaction()`, and `database.rollbackTransaction()` manage transactional work. Nested flows can use `database.createSavepoint(name?)`, `database.rollbackToSavepoint(name)`, and `database.releaseSavepoint(name)`.
- `database.createLeaseTable(tableName)` and `database.acquireLease(tableName, leaseId, owner, ttlMs)` support distributed lease acquisition for scheduled or multi-instance work.
- `database.addUniqueIndex(tableName, columnsJson)` prepares columns for `database.upsert(...)`.

```javascript
function init(context) {
  database.createLeaseTable("job_leases");

  return { success: true };
}
```

## HTTP Fetch

### fetch(url, options)

Makes HTTP requests to external APIs with built-in security features including secret injection for API keys.

**Parameters:**

- `url` (string): The URL to request
- `options` (string, optional): JSON string containing request options

**Options Object:**

- `method` (string, optional): HTTP method - `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`. Default: `"GET"`
- `headers` (object, optional): Request headers as key-value pairs
- `body` (string, optional): Request body for POST/PUT/PATCH requests
- `timeout_ms` (number, optional): Timeout in milliseconds. Default: 30000 (30 seconds)

**Returns:** A response object with

- `status` (number): HTTP status code
- `ok` (boolean): `true` if status is 2xx
- `headers` (object): Response headers
- `body` (string): Response body
- `text()`: the body as text
- `json()`: the body parsed as JSON (throws if it is not JSON)

`fetch` used to return the JSON envelope as a **string**, and the object it
returns now is usable three ways so both styles work:

```javascript
// Browser-shaped
const response = await fetch("https://api.example.com/data");
const data = await response.json();

// The same object, without awaiting — the request is already finished
const response = fetch("https://api.example.com/data");
if (response.ok) {
  const data = response.json();
}

// Still works: toString() yields the original envelope
const response = JSON.parse(fetch("https://api.example.com/data"));
```

`await` is sequencing sugar here: host calls block, so the request has already
finished by the time `fetch` returns. `Promise.all` over several fetches gives
the right answers but runs them one after another.

> **Note:** the response changed shape, the **options did not** — `fetch` still
> takes them as a JSON string, so keep the `JSON.stringify({...})` around them.

**Example - Simple GET Request:**

```javascript
function fetchExample(context) {
  try {
    // Make a GET request
    const response = fetch("https://api.example.com/data");

    if (response.ok) {
      console.log("Fetch successful: " + response.status);
      return {
        status: 200,
        body: response.body,
        contentType: "application/json",
      };
    } else {
      return {
        status: response.status,
        body: "External API error",
        contentType: "text/plain; charset=UTF-8",
      };
    }
  } catch (error) {
    console.log("Fetch error: " + error);
    return { status: 500, body: "Request failed" };
  }
}
```

**Example - POST with JSON:**

```javascript
function createResource(context) {
  const requestData = {
    name: "New Item",
    description: "Created via API",
  };

  const options = JSON.stringify({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestData),
  });

  const response = fetch("https://api.example.com/items", options);

  return {
    status: response.ok ? 200 : 502,
    body: response.body,
    contentType: "application/json",
  };
}
```

**Example - Using Secret Injection for API Keys:**

The fetch function supports secure secret injection using template syntax `{{secret:identifier}}`. This allows you to use API keys stored in the server's secrets manager without exposing them in your script code.

```javascript
function callSecureAPI(context) {
  // Use {{secret:identifier}} syntax to inject secrets securely
  const options = JSON.stringify({
    method: "GET",
    headers: {
      Authorization: "{{secret:api_key}}", // Secret injected by server
      "X-API-Key": "{{secret:external_api_key}}", // Another secret
    },
  });

  const response = fetch("https://secure-api.example.com/data", options);

  return {
    status: 200,
    body: response.body,
    contentType: "application/json",
  };
}
```

**Security Features:**

- **Secret Injection**: Use `{{secret:identifier}}` in headers to securely inject API keys. The secret values never appear in your JavaScript code.
- **URL Validation**: Blocks requests to localhost, private IPs (192.168.x.x, 10.x.x.x, etc.), and local networks
- **Protocol Restrictions**: Only HTTP and HTTPS are allowed (blocks file://, ftp://, etc.)
- **Response Size Limits**: Responses are limited to 10MB to prevent memory exhaustion
- **Timeout Enforcement**: All requests have a timeout (default 30 seconds)
- **TLS/SSL Validation**: HTTPS certificates are validated

**Error Handling:**

```javascript
function robustFetch(context) {
  try {
    const response = fetch("https://api.example.com/data");

    // Handle different response statuses
    if (response.status === 200) {
      return { status: 200, body: response.body };
    } else if (response.status === 404) {
      return { status: 404, body: "Resource not found" };
    } else if (response.status === 429) {
      return { status: 429, body: "Rate limit exceeded" };
    } else {
      return { status: 502, body: "Upstream error" };
    }
  } catch (error) {
    // Fetch errors (network, timeout, blocked URL, etc.)
    console.log("Fetch failed: " + error);
    return { status: 500, body: "Request failed" };
  }
}
```

**Blocked URLs:**

These URLs will be rejected for security reasons:

- `http://localhost/api` - Localhost
- `http://127.0.0.1/api` - Loopback address
- `http://192.168.1.1/api` - Private network
- `http://10.0.0.1/api` - Private network
- `file:///etc/passwd` - File protocol
- `ftp://example.com/file` - FTP protocol

**Best Practices:**

1. **Always use try-catch**: Network requests can fail in many ways
2. **Check response.ok**: Don't assume requests always succeed
3. **Use secrets for API keys**: Never hardcode API keys in scripts
4. **Set appropriate timeouts**: Adjust `timeout_ms` based on expected response time
5. **Handle rate limits**: Implement retry logic for 429 responses
6. **Log errors**: Use `console.log()` to track fetch failures
7. **Validate response data**: Parse and validate JSON responses before using them

## Streaming Connections

### Client-Side Connection

Clients connect to streams using the standard EventSource API:

```javascript
// Connect to a stream from the browser
const eventSource = new EventSource("/notifications");

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("Received:", data);

  // Handle different message types
  if (data.type === "notification") {
    showNotification(data.message);
  }
};

eventSource.onerror = function (event) {
  console.error("Stream connection error:", event);
};
```

### Stream Lifecycle

1. **Registration**: Use `routeRegistry.registerRoute(path, { stream: true })` to create a stream endpoint
2. **Connection**: Clients connect using EventSource or compatible SSE clients
3. **Broadcasting**: Use `routeRegistry.sendStreamMessage()` or `routeRegistry.sendStreamMessageFiltered()` to send data to connected clients
4. **Cleanup**: Connections are automatically cleaned up when clients disconnect

### Best Practices for Streaming

- **Register streams in init()**: Call `routeRegistry.registerRoute(path, { stream: true })` from `init()`
- **Structure your data**: Use consistent message formats with `type` fields
- **Handle disconnections**: Clients should implement reconnection logic
- **Limit message frequency**: Avoid overwhelming clients with too many messages
- **Use meaningful paths**: Organize streams logically (e.g., `/chat/room1`, `/notifications`)
- **Use filtered broadcasting**: Use `routeRegistry.sendStreamMessageFiltered()` for personalized messages instead of creating dynamic endpoints
- **Leverage metadata**: Store user/room information in connection metadata for efficient filtering

## Request Object

The `req` parameter passed to handler functions contains information about the HTTP request.

### Properties

- `method` (string): HTTP method (`"GET"`, `"POST"`, `"PUT"`, `"DELETE"`)
- `path` (string): Request path (e.g., `"/api/users/123"`)
- `query` (object): Query parameters as key-value pairs
- `form` (object): Form data for POST requests (key-value pairs)
- `headers` (object): Request headers

### Examples

```javascript
function exampleHandler(context) {
  const req = context.request;
  // GET /search?q=javascript&page=1
  console.log(req.method); // "GET"
  console.log(req.path); // "/search"
  console.log(req.query); // { q: "javascript", page: "1" }
  console.log(req.form); // {} (empty for GET)

  return { status: 200, body: "OK" };
}
```

For POST requests with form data:

```javascript
function postHandler(context) {
  const req = context.request;
  // POST /submit with form fields: name=John&email=john@example.com
  console.log(req.form); // { name: "John", email: "john@example.com" }

  return { status: 200, body: "Form received" };
}
```

## Response Object

Handler functions must return a response object that defines how the server responds to the request.

### Required Properties

- `status` (number): HTTP status code (e.g., 200, 404, 500)
- `body` (string): Response content

### Optional Properties

- `contentType` (string): MIME type (defaults to `"text/plain; charset=UTF-8"`)

### Response Examples

```javascript
// Simple text response
return {
  status: 200,
  body: "Hello World",
  contentType: "text/plain; charset=UTF-8",
};

// JSON response
return {
  status: 200,
  body: JSON.stringify({ message: "Success", data: [] }),
  contentType: "application/json",
};

// HTML response
return {
  status: 200,
  body: "<h1>Welcome</h1><p>This is HTML content.</p>",
  contentType: "text/html; charset=UTF-8",
};

// Error response
return {
  status: 404,
  body: "Not Found",
  contentType: "text/plain; charset=UTF-8",
};
```

## Response Builders

Convenient helper functions for creating common HTTP responses. These functions return properly formatted response objects that can be returned directly from handlers.

### ResponseBuilder.json(data, status)

Creates a JSON response with automatic content-type header.

**Parameters:**

- `data` (any): Data to serialize as JSON
- `status` (number, optional): HTTP status code (default: 200)

**Returns:** Response object

**Example:**

```javascript
function apiHandler(context) {
  const data = { users: ["Alice", "Bob"], count: 2 };
  return ResponseBuilder.json(data);
}

function errorHandler(context) {
  return ResponseBuilder.json({ error: "Not found" }, 404);
}
```

### ResponseBuilder.text(text, status)

Creates a plain text response.

**Parameters:**

- `text` (string): Text content
- `status` (number, optional): HTTP status code (default: 200)

**Returns:** Response object

**Example:**

```javascript
function helloHandler(context) {
  return ResponseBuilder.text("Hello, World!");
}
```

### ResponseBuilder.html(html, status)

Creates an HTML response.

**Parameters:**

- `html` (string): HTML content
- `status` (number, optional): HTTP status code (default: 200)

**Returns:** Response object

**Example:**

```javascript
function pageHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Welcome</h1>
      <p>This is a dynamic page.</p>
    </body>
    </html>
  `;
  return ResponseBuilder.html(html);
}
```

### ResponseBuilder.error(status, message)

Creates a JSON error response.

**Parameters:**

- `status` (number): HTTP status code
- `message` (string): Error message

**Returns:** Response object

**Example:**

```javascript
function notFoundHandler(context) {
  return ResponseBuilder.error(404, "Resource not found");
}
```

### ResponseBuilder.noContent()

Creates a 204 No Content response.

**Returns:** Response object

**Example:**

```javascript
function deleteHandler(context) {
  // Delete resource
  deleteResource(context.request.params.id);
  return ResponseBuilder.noContent();
}
```

### ResponseBuilder.redirect(location)

Creates a redirect response.

**Parameters:**

- `location` (string): Redirect URL

**Returns:** Response object

**Example:**

```javascript
function redirectHandler(context) {
  return ResponseBuilder.redirect("/new-location");
}
```

## JSX Support

aiwebengine also exposes server-side JSX helpers for building HTML strings in plain JavaScript or TypeScript.

### h(tag, props, ...children)

Creates an HTML string from an intrinsic tag name or a component function.

```javascript
const cardHtml = h(
  "section",
  { className: "card" },
  h("h2", null, "Welcome"),
  h("p", null, "Rendered on the server."),
);
```

### Fragment(props, ...children)

Groups sibling elements without adding an extra wrapper node.

```javascript
const listItems = Fragment(
  null,
  h("li", null, "First"),
  h("li", null, "Second"),
);
```

### JSX example

With TypeScript JSX enabled, JSX expressions render directly to HTML strings and support the built-in `JSX` namespace from the engine type declarations.

```tsx
function Greeting(props) {
  return <p>Hello {props.name}</p>;
}

function pageHandler(context) {
  return ResponseBuilder.html(
    <main>
      <h1>Dashboard</h1>
      <Greeting name="aiwebengine" />
    </main>,
  );
}
```

## Validation Helpers

Functions for validating request parameters and input data. These helpers throw errors when validation fails, making it easy to handle invalid input.

### requireQueryParam(paramName)

Requires a query parameter to be present and non-empty.

**Parameters:**

- `paramName` (string): Name of the required query parameter

**Returns:** String value of the parameter

**Throws:** Error if parameter is missing or empty

**Example:**

```javascript
function searchHandler(context) {
  try {
    const query = requireQueryParam("q");
    const results = search(query);
    return ResponseBuilder.json({ results });
  } catch (error) {
    return ResponseBuilder.error(400, error.message);
  }
}
```

### requirePathParam(paramName)

Requires a path parameter to be present and non-empty.

**Parameters:**

- `paramName` (string): Name of the required path parameter

**Returns:** String value of the parameter

**Throws:** Error if parameter is missing or empty

**Example:**

```javascript
function userHandler(context) {
  try {
    const userId = requirePathParam("id");
    const user = getUser(userId);
    return ResponseBuilder.json({ user });
  } catch (error) {
    return ResponseBuilder.error(400, error.message);
  }
}

// Register with path parameter
routeRegistry.registerRoute("/users/:id", {
  handler: "userHandler",
  method: "GET",
});
```

### validateString(value, minLength, maxLength)

Validates a string's length constraints.

**Parameters:**

- `value` (string): String to validate
- `minLength` (number, optional): Minimum length (default: 0)
- `maxLength` (number, optional): Maximum length (default: Infinity)

**Returns:** The validated string

**Throws:** Error if validation fails

**Example:**

```javascript
function createUserHandler(context) {
  const req = context.request;

  try {
    const name = validateString(req.form.name, 1, 100);
    const email = validateString(req.form.email, 5, 255);

    const user = createUser(name, email);
    return ResponseBuilder.json({ user }, 201);
  } catch (error) {
    return ResponseBuilder.error(400, error.message);
  }
}
```

### validateNumber(value, min, max)

Validates a number's range constraints.

**Parameters:**

- `value` (any): Value to parse and validate as number
- `min` (number, optional): Minimum value
- `max` (number, optional): Maximum value

**Returns:** The validated number

**Throws:** Error if validation fails

**Example:**

```javascript
function updateScoreHandler(context) {
  const req = context.request;

  try {
    const score = validateNumber(req.form.score, 0, 100);
    updateScore(req.params.userId, score);
    return ResponseBuilder.json({ success: true });
  } catch (error) {
    return ResponseBuilder.error(400, error.message);
  }
}
```

### optionalQueryParam(paramName, defaultValue)

Gets an optional query parameter with a fallback value.

**Parameters:**

- `paramName` (string): Name of the query parameter
- `defaultValue` (any): Default value if parameter is missing

**Returns:** Parameter value or default value

**Example:**

```javascript
function listHandler(context) {
  const page = optionalQueryParam("page", "1");
  const limit = optionalQueryParam("limit", "10");

  const results = getItems(parseInt(page), parseInt(limit));
  return ResponseBuilder.json({ results });
}
```

## Validation Object

The `validate` object provides the same validation functions with a more structured API:

```javascript
// Object-style API
const userId = validate.requirePathParam(context, "userId");
const name = validate.validateString(req.form.name, {
  minLength: 1,
  maxLength: 100,
});
const age = validate.validateNumber(req.form.age, { min: 0, max: 150 });
```

**Available methods:**

- `validate.requireQueryParam(context, paramName)`
- `validate.requirePathParam(context, paramName)`
- `validate.validateString(value, options)` - options: `{ minLength, maxLength, pattern }`
- `validate.validateNumber(value, options)` - options: `{ min, max }`

### Console

Basic console logging (output goes to server logs).

**Methods:**

- `console.log(message)`: Log a message (level: LOG)
- `console.info(message)`: Log an informational message (level: INFO)
- `console.warn(message)`: Log a warning message (level: WARN)
- `console.error(message)`: Log an error message (level: ERROR)
- `console.debug(message)`: Log a debug message (level: DEBUG)
  Reading logs back is the HTTP API's job: `GET /engine/script_logs` returns
  `{uri, logs, count, timestamp}`, with each entry shaped
  `{scriptUri, message, level, timestamp, seq, requestId, kind, route}`. Omit
  `uri` for every script (newest first) or pass one for a single script (oldest
  first); `level`, `since`, `limit`, `contains`, `request_id`, `kind`, `route`
  and `after_seq` narrow the result. `GET /engine/script_logs/stream` follows
  the log live over Server-Sent Events with the same filters.
  `DELETE /engine/script_logs` prunes every script back to its newest entries,
  or clears one script's logs when given a `uri`. The engine answers all three
  as the signed-in user, so an Administrator or an owner of the script sees its
  entries and everyone else is refused. See the
  [Logging guide](../guides/logging.md) for the full parameter list.

> **Removed globals:** `console.listLogs()`, `console.listLogsForUri(uri)` and
> `console.pruneLogs()` no longer exist — reading and pruning logs is the HTTP
> API's job.

**Example:**

```javascript
function debugHandler(context) {
  const req = context.request;
  console.log("Request received: " + req.path);
  console.error("This is an error message");

  return { status: 200, body: "Check logs" };
}
```

Reading them back from a page, with the visitor's own session:

```javascript
// Every script, newest first
const { logs } = await (await fetch("/engine/script_logs?limit=100")).json();

// One script's errors, oldest first
const uri = encodeURIComponent("https://example.com/api-users");
const errors = await (
  await fetch(`/engine/script_logs?uri=${uri}&level=ERROR`)
).json();

// Each entry has: scriptUri, message, level, timestamp (in milliseconds),
// seq, requestId, kind and route
logs.forEach((log) => {
  console.log(
    `${new Date(log.timestamp).toISOString()} [${log.level}] ${log.message}`,
  );
});

// Follow the log as it is written
const source = new EventSource(`/engine/script_logs/stream?uri=${uri}`);
source.addEventListener("log", (event) => {
  const entry = JSON.parse(event.data);
  console.log(`[${entry.level}] ${entry.message}`);
});
```

## HTTP Status Codes

Common HTTP status codes you might use:

- `200` - OK (success)
- `201` - Created (resource created)
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (access denied)
- `404` - Not Found (resource doesn't exist)
- `405` - Method Not Allowed (wrong HTTP method)
- `500` - Internal Server Error (server error)

## Content Types

Common MIME types for `contentType`:

- `"text/plain; charset=UTF-8"` - Plain text
- `"text/html; charset=UTF-8"` - HTML content
- `"application/json"` - JSON data
- `"application/xml"` - XML data
- `"image/jpeg"`, `"image/png"` - Images
- `"application/pdf"` - PDF files

## Conversion Functions

The `convert` object provides content conversion utilities.

### convert.markdown_to_html(markdown)

Converts a markdown string to HTML.

**Parameters:**

- `markdown` (string): Markdown content to convert (max 1MB)

**Returns:** String containing HTML output or error message (starting with "Error:")

**Example:**

```javascript
function renderBlogPost(context) {
  const req = context.request;

  const markdown = `# My Blog Post

This is **bold** and *italic* text.

\`\`\`javascript
const hello = "world";
\`\`\`
`;

  const html = convert.markdown_to_html(markdown);

  if (html.startsWith("Error:")) {
    return { status: 500, body: html };
  }

  return {
    status: 200,
    body: `<!DOCTYPE html>
<html>
<head><title>Blog</title></head>
<body>${html}</body>
</html>`,
    contentType: "text/html; charset=UTF-8",
  };
}
```

**Supported Features:**

- Headings, bold, italic, strikethrough
- Code blocks and inline code
- Lists (ordered and unordered)
- Tables with alignment
- Links and images
- Blockquotes
- Task lists
- Footnotes

**See Also:** [Conversion API Reference](conversion-api.md) for detailed documentation, examples, and best practices.

## Scheduler Service

Scripts can use `schedulerService` to register background jobs that run even when no HTTP requests are active. Jobs live entirely in memory and are cleared automatically whenever the script is reinitialized or deleted.

> **Requirements:**
>
> - All timestamps must be expressed in UTC (ISO-8601 strings ending with `Z`).
> - Scheduled handlers run without an HTTP caller, so `context.request` carries no
>   authenticated user; anything they touch is scoped to the script itself.

### schedulerService.registerOnce(options)

Schedule a single execution at an exact UTC timestamp.

**Options:**

- `handler` (string, required): Name of the handler function to invoke.
- `runAt` (string, required): ISO-8601 timestamp in UTC, e.g. `"2025-03-01T12:00:00Z"`.
- `name` (string, optional): Friendly identifier used for logging/overwriting. Defaults to the handler name.

**Returns:** String describing the scheduled execution time and job id.

### schedulerService.registerRecurring(options)

Register a handler that executes on a fixed interval.

**Options:**

- `handler` (string, required)
- `intervalMinutes` (number, required, `>= 1`): Interval length in minutes.
- `startAt` (string, optional): UTC timestamp for the first execution. When omitted the first run happens one interval from now.
- `name` (string, optional): Friendly identifier used for logging/overwriting.

**Returns:** String indicating the cadence, next run, and job id.

### schedulerService.clearAll()

Removes every scheduled job for the current script. This runs automatically before each `init()` execution but can be called manually if your script rebuilds schedules dynamically.

### Scheduled Handler Context

Scheduled invocations receive the unified `context` object with extra metadata:

```javascript
function sendReport(context) {
  const schedule = context.meta?.schedule;
  console.log(
    `Running job ${schedule.name} (${schedule.jobId}) at ${schedule.scheduledFor}`,
  );
  // ... generate report ...
  return { status: 200, body: "OK" };
}
```

`context.meta.schedule` contains:

- `jobId`: UUID assigned by the scheduler
- `name`: Job name (defaults to handler name)
- `type`: `"one-off"` or `"recurring"`
- `scheduledFor`: Current execution time in UTC
- `intervalSeconds`: Interval length for recurring jobs (or `null`)

### Complete Example

```javascript
function sendDailyDigest(context) {
  const info = context.meta?.schedule || {};
  console.log(`Digest job ${info.name} running @ ${info.scheduledFor}`);
  // Build and send email, push notification, etc.
  return { status: 200, body: "sent" };
}

function init(context) {
  // Clear any stale definitions from previous deploys
  schedulerService.clearAll();

  // Run once at a fixed time tomorrow
  schedulerService.registerOnce({
    handler: "sendDailyDigest",
    runAt: "2025-01-01T09:00:00Z",
    name: "digest-onboarding",
  });

  // Run every 30 minutes starting immediately
  schedulerService.registerRecurring({
    handler: "sendDailyDigest",
    intervalMinutes: 30,
    name: "digest-heartbeat",
  });

  return { success: true };
}
```

Tips:

1. Pick deterministic `name` values so re-registration overwrites the previous job instead of creating duplicates.
2. Keep scheduled handlers idempotent—if the engine restarts, missed jobs resume on the next interval.
3. Log meaningful progress or failures. The engine also records `FATAL` log entries when a scheduled handler throws.

## Error Handling

Scripts run in a sandboxed environment. If a script throws an error:

- The server returns a `500 Internal Server Error`
- The error is logged to the server logs
- The request fails gracefully

**Example error handling:**

```javascript
function safeHandler(context) {
  const req = context.request;
  try {
    // Your code here
    if (!req.query.id) {
      return { status: 400, body: "Missing id parameter" };
    }

    return { status: 200, body: "Success" };
  } catch (error) {
    console.log("Error in handler: " + error.message);
    return { status: 500, body: "Internal server error" };
  }
}
```

## Best Practices

1. **Validate input**: Always check required parameters
2. **Use appropriate status codes**: Return meaningful HTTP status codes
3. **Set content types**: Specify correct MIME types for responses
4. **Log important events**: Use `console.log()` for debugging
5. **Handle errors gracefully**: Use try-catch for robust scripts
6. **Keep responses small**: Avoid very large response bodies

## Next Steps

- See [examples](../examples/index.md) for practical usage patterns
- Use the web editor at `/editor` for testing and development
- Check the [deployment workflow](../getting-started/03-deployment-workflow.md) for publishing scripts
