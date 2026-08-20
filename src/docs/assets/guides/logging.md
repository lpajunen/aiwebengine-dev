# Logging and Debugging Guide

Learn how to write, read, and use logs effectively for debugging and monitoring your aiwebengine scripts.

## Overview

Logging is essential for:

- **Debugging** - Finding and fixing issues
- **Monitoring** - Tracking script behavior
- **Auditing** - Recording important actions
- **Performance** - Identifying bottlenecks

## Writing Logs

### The `console.log()` Function

```javascript
console.log(message);
```

Writes a message to the server's log system.

**Example:**

```javascript
function myHandler(context) {
  const req = context.request;
  console.log("Request received");

  const result = processRequest(req);

  console.log(`Request processed: ${result.status}`);

  return {
    status: 200,
    body: JSON.stringify(result),
    contentType: "application/json",
  };
}
```

### What to Log

**Log important events:**

```javascript
console.log("User login attempt: " + email);
console.log("Payment processed: $" + amount);
console.log("File uploaded: " + filename);
console.log("Email sent to: " + recipient);
```

**Log errors:**

```javascript
try {
  processData(data);
} catch (error) {
  console.log(`Error processing data: ${error.message}`);
}
```

**Log state changes:**

```javascript
console.log(`User ${userId} status changed from ${oldStatus} to ${newStatus}`);
console.log(`Cart updated: ${items.length} items, total $${total}`);
```

**Log performance metrics:**

```javascript
const start = Date.now();
const result = expensiveOperation();
const duration = Date.now() - start;
console.log(`Operation completed in ${duration}ms`);
```

### What NOT to Log

**Avoid logging:**

- Sensitive data (passwords, tokens, credit cards)
- Personal information (unless necessary)
- Excessive noise (every minor operation)
- Large data payloads

**Bad examples:**

```javascript
// DON'T log passwords
console.log(`User logged in with password: ${password}`); // ❌

// DON'T log tokens
console.log(`API token: ${apiToken}`); // ❌

// DON'T log full request objects
console.log(JSON.stringify(req)); // ❌ Too much data
```

### Structured Logging

Use consistent formats for easier parsing:

```javascript
function logEvent(event, data) {
  const timestamp = new Date().toISOString();
  const message = `[${event}] ${JSON.stringify(data)}`;
  console.log(message);
}

// Usage
logEvent("USER_LOGIN", { email: "user@example.com", success: true });
logEvent("API_CALL", { endpoint: "/api/users", duration: 234 });
logEvent("ERROR", { function: "createUser", error: "Email exists" });
```

## Reading Logs

### Method 1: Web Editor

The easiest way to view logs:

1. Open `/editor`
2. Click "Logs" tab
3. Select your script from dropdown
4. Logs auto-refresh every 5 seconds

**Features:**

- Real-time updates
- Filter by script
- Jump to latest button (scrolls view to newest entry)
- Timestamps included

### Method 2: `GET /engine/script_logs`

Read logs back over the engine's HTTP API. The engine answers based on the
signed-in user: an **Administrator** or an owner of the script sees its
entries, everyone else is refused.

| Parameter | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `uri`     | One script's logs; omit for every script                      |
| `level`   | Only entries at this level, e.g. `ERROR`                      |
| `since`   | Only entries at or after this time (epoch millis or RFC 3339) |
| `limit`   | Keep at most this many of the newest matching entries         |

The response is `{uri, logs, count, timestamp}`, where each entry is
`{scriptUri, message, level, timestamp}` and `timestamp` is milliseconds since
the epoch. Entries come back **oldest first** for a single script and **newest
first** for the all-scripts view.

From a page, call it with the visitor's own session:

```javascript
const response = await fetch("/engine/script_logs?limit=100");
const { logs } = await response.json();

logs.forEach((log) => {
  console.log(
    `${new Date(log.timestamp).toISOString()} [${log.level}] ${log.message}`,
  );
});
```

To narrow to one script, pass its URI:

```javascript
const uri = "https://example.com/api-users";
const response = await fetch(
  `/engine/script_logs?uri=${encodeURIComponent(uri)}&level=ERROR`,
);
const { logs, count } = await response.json();
```

From a server-side handler, forward the caller's credentials so the engine
applies **their** permissions rather than answering anonymously:

```javascript
function logsHandler(context) {
  const req = context.request;
  const headers = {};
  if (req.headers.authorization)
    headers.Authorization = req.headers.authorization;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;

  const response = JSON.parse(
    fetch(`https://${req.headers.host}/engine/script_logs?limit=100`, {
      headers: headers,
    }),
  );

  return {
    status: response.status,
    body: response.body,
    contentType: "application/json",
  };
}

routeRegistry.registerRoute("/my-logs", "logsHandler", "GET");
```

### Pruning with `DELETE /engine/script_logs`

`DELETE /engine/script_logs` prunes every script back to its newest entries.
Given a `uri` it clears that one script's logs outright:

```javascript
// Prune every script
await fetch("/engine/script_logs", { method: "DELETE" });

// Clear one script's logs
await fetch(`/engine/script_logs?uri=${encodeURIComponent(uri)}`, {
  method: "DELETE",
});
```

> **Superseded globals:** `console.listLogs()`, `console.listLogsForUri(uri)`
> and `console.pruneLogs()` still work and return the same entries as a JSON
> string, but they predate the endpoints above and cannot filter by level,
> time or count. Prefer `/engine/script_logs` in new scripts.

### Method 3: Server Logs

Check server console or log files:

```bash
# If running with cargo
cargo run
# Logs appear in console

# If running as service
journalctl -u aiwebengine -f

# Log files (if configured)
tail -f /var/log/aiwebengine/server.log
```

## Log Viewer Scripts

### Basic Log Viewer

Both viewers below share this helper, which calls `/engine/script_logs` with
the caller's own credentials so the engine applies their permissions:

```javascript
/** Read log entries over the engine's HTTP API, as the calling user. */
function readLogs(req, query) {
  const headers = {};
  if (req.headers.authorization)
    headers.Authorization = req.headers.authorization;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;

  const response = JSON.parse(
    fetch(`https://${req.headers.host}/engine/script_logs${query}`, {
      headers: headers,
    }),
  );
  return JSON.parse(response.body).logs || [];
}
```

```javascript
function logViewerHandler(context) {
  const logs = readLogs(context.request, "");

  const logItems = logs
    .map((log) => {
      return `<li><code>${log.message}</code></li>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logs</title>
      <style>
        body { font-family: monospace; padding: 20px; }
        ul { list-style: none; padding: 0; }
        li { padding: 5px; border-bottom: 1px solid #eee; }
        code { color: #333; }
      </style>
    </head>
    <body>
      <h1>Script Logs</h1>
      <ul>${logItems}</ul>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}

routeRegistry.registerRoute("/logs-viewer", "logViewerHandler", "GET");
```

### Advanced Log Viewer with Filtering

```javascript
function advancedLogViewerHandler(context) {
  const filter = context.request.query.filter || "";
  const level = context.request.query.level || "all";

  const logs = readLogs(context.request, "");

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const message = log.message || "";
    if (filter && !message.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }

    if (level !== "all") {
      if (level === "error" && (log.level || "").toLowerCase() !== "error") {
        return false;
      }
      if (
        level === "warning" &&
        (log.level || "").toLowerCase() !== "warning"
      ) {
        return false;
      }
    }

    return true;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Log Viewer</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .filters { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
        .log-entry { padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 14px; }
        .log-entry:hover { background: #f9f9f9; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        .info { color: #1976d2; }
      </style>
    </head>
    <body>
      <h1>Log Viewer</h1>
      
      <div class="filters">
        <form method="GET">
          <label>
            Filter: 
            <input type="text" name="filter" value="${filter}" placeholder="Search logs...">
          </label>
          
          <label>
            Level:
            <select name="level">
              <option value="all" ${level === "all" ? "selected" : ""}>All</option>
              <option value="error" ${level === "error" ? "selected" : ""}>Errors</option>
              <option value="warning" ${level === "warning" ? "selected" : ""}>Warnings</option>
              <option value="info" ${level === "info" ? "selected" : ""}>Info</option>
            </select>
          </label>
          
          <button type="submit">Filter</button>
        </form>
      </div>
      
      <div>
        <p><strong>${filteredLogs.length}</strong> log entries</p>
        ${filteredLogs
          .map((log) => {
            const level = (log.level || "").toLowerCase();
            let className = "log-entry";
            if (level === "error") className += " error";
            else if (level === "warning") className += " warning";
            else if (level === "info") className += " info";

            return `<div class="${className}">${log.message}</div>`;
          })
          .join("")}
      </div>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}

routeRegistry.registerRoute(
  "/advanced-logs",
  "advancedLogViewerHandler",
  "GET",
);
```

## Debugging Techniques

### 1. Trace Execution Flow

Add logs at key points:

```javascript
function complexHandler(context) {
  const req = context.request;
  console.log("complexHandler: Start");

  console.log("complexHandler: Validating input");
  if (!validateInput(req)) {
    console.log("complexHandler: Validation failed");
    return errorResponse(400, "Invalid input");
  }

  console.log("complexHandler: Processing data");
  const result = processData(req.form);

  console.log(`complexHandler: Processing complete, result: ${result.status}`);

  console.log("complexHandler: Saving to database");
  saveToDatabase(result);

  console.log("complexHandler: End");
  return jsonResponse(200, result);
}
```

### 2. Log Variable Values

Inspect data at runtime:

```javascript
function debugHandler(context) {
  const req = context.request;
  console.log(`Received query: ${JSON.stringify(req.query)}`);
  console.log(`Received form: ${JSON.stringify(req.form)}`);

  const processedData = transformData(req.form);
  console.log(`Processed data: ${JSON.stringify(processedData)}`);

  return jsonResponse(200, processedData);
}
```

### 3. Conditional Logging

Log only when needed:

```javascript
const DEBUG = true;

function debugLog(message) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
  }
}

function myHandler(context) {
  const req = context.request;
  debugLog("Handler called with path: " + req.path);

  // Your logic

  debugLog("Handler completed");
  return jsonResponse(200, { success: true });
}
```

### 4. Error Context

Provide context when logging errors:

```javascript
function createUserHandler(context) {
  const req = context.request;
  try {
    const user = createUser(req.form);
    console.log(`User created successfully: ${user.email}`);
    return jsonResponse(201, { user: user });
  } catch (error) {
    console.log(`ERROR in createUserHandler: ${error.message}`);
    console.log(`  Input data: ${JSON.stringify(req.form)}`);
    console.log(`  Stack: ${error.stack || "No stack trace"}`);
    return errorResponse(500, "Failed to create user");
  }
}
```

### 5. Performance Logging

Measure execution time:

```javascript
function timedOperation(name, operation) {
  const start = Date.now();
  console.log(`${name}: Starting`);

  try {
    const result = operation();
    const duration = Date.now() - start;
    console.log(`${name}: Completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`${name}: Failed after ${duration}ms - ${error.message}`);
    throw error;
  }
}

function slowHandler(context) {
  return timedOperation("slowHandler", () => {
    // Your slow operation
    const result = expensiveComputation();
    return jsonResponse(200, result);
  });
}
```

## Log Patterns

### Request/Response Logging

```javascript
function loggedHandler(context) {
  const req = context.request;
  const requestId = generateRequestId();

  console.log(`[${requestId}] Request: ${req.method} ${req.path}`);
  console.log(`[${requestId}] Query: ${JSON.stringify(req.query)}`);

  try {
    const response = processRequest(req);
    console.log(`[${requestId}] Response: ${response.status}`);
    return response;
  } catch (error) {
    console.log(`[${requestId}] Error: ${error.message}`);
    throw error;
  }
}
```

### Audit Logging

```javascript
function auditLog(action, user, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    action: action,
    user: user,
    details: details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function deleteUserHandler(context) {
  const req = context.request;
  const userId = req.query.id;
  const currentUser = getCurrentUser(req);

  auditLog("DELETE_USER", currentUser, { userId: userId });

  deleteUser(userId);

  return jsonResponse(200, { message: "User deleted" });
}
```

### Metric Collection

```javascript
const metrics = {
  requests: 0,
  errors: 0,
  totalDuration: 0,
};

function metricsHandler(context) {
  const req = context.request;
  const start = Date.now();
  metrics.requests++;

  try {
    const result = processRequest(req);
    const duration = Date.now() - start;
    metrics.totalDuration += duration;

    console.log(`[METRICS] Request completed in ${duration}ms`);

    return result;
  } catch (error) {
    metrics.errors++;
    console.log(`[METRICS] Request failed: ${error.message}`);
    throw error;
  }
}

function statsHandler(context) {
  const avgDuration =
    metrics.requests > 0 ? metrics.totalDuration / metrics.requests : 0;

  const stats = {
    totalRequests: metrics.requests,
    totalErrors: metrics.errors,
    averageDuration: Math.round(avgDuration),
    errorRate:
      metrics.requests > 0
        ? ((metrics.errors / metrics.requests) * 100).toFixed(2) + "%"
        : "0%",
  };

  return jsonResponse(200, stats);
}

routeRegistry.registerRoute("/stats", "statsHandler", "GET");
```

## Best Practices

### 1. Use Consistent Formats

```javascript
// Good - consistent format
console.log("USER_LOGIN: user@example.com - SUCCESS");
console.log("USER_LOGOUT: user@example.com - SUCCESS");
console.log("USER_LOGIN: user@example.com - FAILED: Invalid password");

// Bad - inconsistent
console.log("User logged in: user@example.com");
console.log("Logout successful for user@example.com");
console.log("Login error: Invalid password");
```

### 2. Include Context

```javascript
// Good - includes context
console.log(
  `createOrder: User ${userId} ordered ${items.length} items, total $${total}`,
);

// Bad - lacks context
console.log("Order created");
```

### 3. Log Levels (Manual)

Implement log levels yourself:

```javascript
function logError(message) {
  console.log(`[ERROR] ${message}`);
}

function logWarning(message) {
  console.log(`[WARNING] ${message}`);
}

function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

function logDebug(message) {
  if (DEBUG_MODE) {
    console.log(`[DEBUG] ${message}`);
  }
}

// Usage
logInfo("Server started");
logWarning("Cache miss for key: users_list");
logError("Database connection failed");
logDebug("Variable value: " + someVar);
```

### 4. Don't Log in Loops (Usually)

```javascript
// Bad - too many logs
for (let i = 0; i < 1000; i++) {
  console.log(`Processing item ${i}`); // ❌ 1000 log entries!
  processItem(items[i]);
}

// Good - log summary
console.log(`Processing ${items.length} items`);
for (let i = 0; i < items.length; i++) {
  processItem(items[i]);
}
console.log(`Processed all items successfully`);

// Also good - log milestones
for (let i = 0; i < 1000; i++) {
  if (i % 100 === 0) {
    console.log(`Processed ${i}/1000 items`);
  }
  processItem(items[i]);
}
```

### 5. Sanitize Sensitive Data

```javascript
function sanitizeEmail(email) {
  const [user, domain] = email.split("@");
  return `${user.substring(0, 2)}***@${domain}`;
}

function sanitizeCardNumber(card) {
  return `****-****-****-${card.slice(-4)}`;
}

// Usage
console.log(`Payment processed for ${sanitizeEmail(email)}`);
console.log(`Card ending in ${sanitizeCardNumber(cardNumber)}`);
```

## Troubleshooting

### Logs Not Appearing

**Check:**

- `console.log()` is actually being called
- Script executed successfully (no errors before log call)
- Correct script selected in log viewer
- Logs viewer refreshed

### Too Many Logs

**Solutions:**

- Add log levels and filter
- Remove debug logs from production
- Log summaries instead of details
- Use sampling (log every Nth request)

### Can't Find Specific Logs

**Solutions:**

- Use structured logging with searchable formats
- Include unique identifiers (request IDs)
- Use the log viewer with filters
- Add more context to log messages

## Next Steps

- **[Script Development](scripts.md)** - Learn more about handlers
- **[AI Development](ai-development.md)** - Use AI for debugging
- **[Examples](../examples/index.md)** - See logging in practice
- **[API Reference](../reference/javascript-apis.md)** - Complete API docs

## Quick Reference

```javascript
// Write a log message
console.log("Message");

// Read logs over the engine's HTTP API (every script, newest first)
const { logs } = await (await fetch("/engine/script_logs?limit=100")).json();

// Narrow to one script, one level, the newest 50 entries
const uri = encodeURIComponent("https://example.com/api-users");
const recent = await (
  await fetch(`/engine/script_logs?uri=${uri}&level=ERROR&limit=50`)
).json();

// Prune every script back to its newest entries
await fetch("/engine/script_logs", { method: "DELETE" });

// Log helper functions
function logError(msg) {
  console.log(`[ERROR] ${msg}`);
}
function logInfo(msg) {
  console.log(`[INFO] ${msg}`);
}
```
