# Your First Script

Welcome to aiwebengine! This guide will walk you through creating your first JavaScript script and deploying it to the engine.

## What You'll Build

A simple "Hello World" API endpoint that:

- Responds to HTTP GET requests
- Accepts query parameters
- Returns personalized greetings
- Logs each request

## Prerequisites

Before you start, make sure you have:

- aiwebengine running and accessible
- Access to the `/editor` interface, or a checkout with the repository tooling
- Basic JavaScript knowledge

## Step 1: Understanding Script Structure

A script is a tree of files whose entrypoint is `main.js` (or `main.ts`). A
script that serves HTTP has two parts:

```javascript
// 1. Handler function - processes requests
function myHandler(context) {
  const req = context.request;

  return ResponseBuilder.text("Hello!");
}

// 2. init() - registers routes; the engine calls it, you never do
function init() {
  routeRegistry.registerRoute("/hello", {
    handler: "myHandler",
    method: "GET",
  });
}
```

**Key Concepts:**

- **Handler functions** receive a single `context` object; the HTTP request is `context.request`
- **`ResponseBuilder`** helpers (`.text`, `.json`, `.html`, `.error`, `.redirect`) build the response and set its `Content-Type`
- **`init()`** is optional. The engine calls it when the script is loaded and on every save; it is the only place a registration takes effect
- **`routeRegistry.registerRoute(path, { handler: "handlerName", method: "GET" })`** maps URLs to handler functions. The handler is named by string and must be a top-level function of `main.js`

## Step 2: Create Your First Script

### Option A: Using the Web Editor

1. **Open the editor:**

```text
http://localhost:3000/editor
```

1. **Click "+ New"**

1. **Enter the script name** (lower-case letters, digits, `-` and `_`):

```text
hello
```

1. **Replace the starter code with this:**

```javascript
/**
 * hello - Your first aiwebengine script
 *
 * A simple greeting API that demonstrates:
 * - Request handling
 * - Query parameters
 * - Response formatting
 * - Logging
 */

function helloHandler(context) {
  const req = context.request;

  // Extract the 'name' parameter from the query string
  const name = req.query.name || "World";

  // Log the request
  console.log(`Greeting requested for: ${name}`);

  // Create the greeting message
  const greeting = `Hello, ${name}! Welcome to aiwebengine.`;

  // Return the response
  return ResponseBuilder.text(greeting);
}

function init() {
  // Register the route
  routeRegistry.registerRoute("/hello", {
    handler: "helloHandler",
    method: "GET",
  });
  console.log("Hello script initialized successfully");
}
```

1. **Click "Save"**

### Option B: From a checkout

1. **Create `hello/main.js`** in a repository that includes `scripts/tooling.mk`,
   with the code above.

1. **Deploy it:**

   ```bash
   make oauth-login                       # once
   make deploy-changed URI=hello FILES="hello/main.js"
   ```

## Step 3: Test Your Script

### Browser Test

Open your browser and visit:

```text
http://localhost:3000/hello
```

You should see:

```text
Hello, World! Welcome to aiwebengine.
```

### Test with Parameters

Try adding a query parameter:

```text
http://localhost:3000/hello?name=Alice
```

You should see:

```text
Hello, Alice! Welcome to aiwebengine.
```

### Test with curl

```bash
# Basic request
curl http://localhost:3000/hello

# With parameters
curl "http://localhost:3000/hello?name=Bob"
```

## Step 4: View the Logs

Your script is logging each request. Let's see the logs:

### Using the Editor

1. Go to `http://localhost:3000/editor`
2. Select your `hello` script
3. Click the "Logs" tab at the top
4. You'll see entries like:

```text
[2024-10-24 10:30:15] Greeting requested for: Alice
[2024-10-24 10:30:12] Greeting requested for: World
[2024-10-24 10:30:00] Hello script initialized successfully
```

### Reading the log over HTTP

As the script's owner (or an administrator), on the management host:

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/engine/read_logs?script=hello"
```

## Understanding the Context and Response

### The Handler Context (`context`)

Every handler receives a single `context` object:

- `request`: the HTTP request (for other kinds of invocation, an object with an empty `query`)
- `args`: an MCP tool's or prompt's arguments; `null` for HTTP routes
- `kind`: the invocation type (`httpRoute`, `scheduled`, `mcpTool`, etc.)
- `scriptUri` / `handlerName`: which script and handler are running
- `invocationId`: the id this invocation's log lines are filed under
- `meta`: what a scheduled job or task was given (`meta.schedule`, `meta.task`)

Pattern most handlers use:

```javascript
function helloHandler(context) {
  const req = context.request;
  // use req as shown below
}
```

### The Request Object (`context.request`)

When a client makes a request to `/hello?name=Alice`, `context.request` looks like:

```javascript
{
  method: "GET",
  path: "/hello",
  query: { name: "Alice" },
  form: {},
  headers: { /* request headers */ }
}
```

### The Response Object

Your handler returns a response, usually built with `ResponseBuilder`. What it
builds is a plain object, and you may return one directly:

```javascript
{
  status: 200,              // HTTP status code
  body: "Hello, Alice!",    // Response content (or bodyBase64 for binary)
  contentType: "text/plain; charset=UTF-8", // MIME type (optional)
  headers: { "Cache-Control": "no-store" }  // extra headers (optional)
}
```

**Common Status Codes:**

- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `500` - Server Error

## Step 5: Enhance Your Script

Let's add some features to make it more robust:

```javascript
function helloHandler(context) {
  const req = context.request;
  const name = req.query.name;

  // Validate input
  if (!name) {
    return ResponseBuilder.error(400, "'name' parameter is required");
  }

  // Sanitize input (basic example)
  if (name.length > 50) {
    return ResponseBuilder.error(400, "Name too long (max 50 characters)");
  }

  // Log the request
  console.log(`Greeting requested for: ${name}`);

  // Create a more detailed response
  const response = {
    greeting: `Hello, ${name}!`,
    message: "Welcome to aiwebengine",
    timestamp: new Date().toISOString(),
  };

  // Return JSON response
  return ResponseBuilder.json(response);
}

function init() {
  routeRegistry.registerRoute("/hello", {
    handler: "helloHandler",
    method: "GET",
  });
  console.log("Enhanced hello script initialized");
}
```

Test it:

```bash
curl "http://localhost:3000/hello?name=Alice"
```

Response:

```json
{
  "greeting": "Hello, Alice!",
  "message": "Welcome to aiwebengine",
  "timestamp": "2024-10-24T10:30:15.123Z"
}
```

## Common Mistakes and Solutions

### ❌ Mistake 1: Registering outside `init()`

```javascript
function helloHandler(context) {
  /* ... */
}

routeRegistry.registerRoute("/hello", { handler: "helloHandler" }); // Top level!
init(); // Never call init() yourself
```

**Solution:** Register inside `function init()` and let the engine call it.
Top-level code runs again on every request, so keep it to definitions.

### ❌ Mistake 2: Handler name mismatch

```javascript
function helloHandler(context) {
  const req = context.request;
  /* ... */
}

function init() {
  routeRegistry.registerRoute("/hello", { handler: "hello", method: "GET" }); // Wrong name!
}
```

**Solution:** Use the exact function name as a string in `routeRegistry.registerRoute()`.

### ❌ Mistake 3: Forgetting to return a response

```javascript
function badHandler(context) {
  const req = context.request;
  console.log("Processing request");
  // Forgot to return!
}
```

**Solution:** Always return a response, for example `ResponseBuilder.text("Done")`.

### ❌ Mistake 4: Wrong content type for JSON

```javascript
return {
  status: 200,
  body: JSON.stringify({ data: "value" }),
  contentType: "text/plain; charset=UTF-8", // Should be "application/json"!
};
```

**Solution:** Use `ResponseBuilder.json(data)`, which sets the content type.

## Next Steps

Now that you've created your first script, you can:

1. **[Learn the Web Editor](02-working-with-editor.md)** - Master the browser-based development environment
2. **[Explore the Deployment Workflow](03-deployment-workflow.md)** - Learn different ways to publish scripts
3. **[Study Script Development](../guides/scripts.md)** - Deep dive into script features
4. **[Check out Examples](../examples/index.md)** - See more complex patterns

## Quick Reference

### Essential Functions

```javascript
// Register a route
routeRegistry.registerRoute(path, { handler: "handlerName", method: "GET" });

// Write to logs; read them in the editor's Logs tab,
// or with GET /engine/read_logs?script=<name>
console.log(message);
```

### Handler Template

```javascript
function myHandler(context) {
  const req = context.request;

  try {
    // Your logic here

    return ResponseBuilder.text("Success");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return ResponseBuilder.error(500, "Internal server error");
  }
}

function init() {
  routeRegistry.registerRoute("/my-path", {
    handler: "myHandler",
    method: "GET",
  });
}
```

## Getting Help

- **API Reference**: [JavaScript APIs](../reference/javascript-apis.md)
- **Examples**: [Code Examples](../examples/index.md)
- **Community**: GitHub Issues

## IDE Support with TypeScript Definitions

For autocomplete and type checking in your IDE (VS Code, WebStorm, etc.), download the engine's type definitions into your checkout. A repository that includes `scripts/tooling.mk` does it with `make fetch-types`; otherwise:

```bash
mkdir -p types
curl -o types/aiwebengine.d.ts http://localhost:3000/engine/types/v0.1.0/aiwebengine.d.ts
```

Then reference the file at the top of each script. The path is relative to the script and must be a local file — TypeScript does not follow a URL:

```javascript
/// <reference path="../types/aiwebengine.d.ts" />
```

### Benefits

- **Autocomplete**: Get suggestions for all available APIs as you type
- **Type checking**: Catch errors before runtime
- **Documentation**: See inline documentation for all functions and parameters
- **Better refactoring**: Safely rename variables and functions

### Example with Type Support

```javascript
/// <reference path="../types/aiwebengine.d.ts" />

/**
 * @param {HandlerContext} context
 * @returns {HttpResponse}
 */
function helloHandler(context) {
  const req = context.request;

  // IDE now provides autocomplete for req.query, req.method, etc.
  const name = req.query.name || "World";

  // IDE knows about ResponseBuilder.text() and its parameters
  return ResponseBuilder.text(`Hello, ${name}!`);
}

function init() {
  // Autocomplete for routeRegistry methods
  routeRegistry.registerRoute("/hello", {
    handler: "helloHandler",
    method: "GET",
  });
}
```

### Optional: Configure jsconfig.json

For persistent type checking across all your scripts, create a `jsconfig.json` file in your scripts directory:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "target": "ES2020",
    "lib": ["ES2020"]
  },
  "include": ["*.js"],
  "exclude": ["node_modules"]
}
```

Then configure VS Code to use the type definitions globally by adding to your workspace settings (`.vscode/settings.json`):

```json
{
  "js/ts.implicitProjectConfig.checkJs": true
}
```

Congratulations on creating your first script! 🎉
