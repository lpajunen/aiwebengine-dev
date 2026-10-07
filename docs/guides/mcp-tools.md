# MCP Tools Development

Learn how to create and register Model Context Protocol (MCP) tools in your scripts to extend AI capabilities.

## What are MCP Tools?

MCP (Model Context Protocol) tools allow you to expose custom functions that AI assistants like Claude, GitHub Copilot, and other MCP clients can discover and execute. This enables AI to interact with your application's APIs, access data, and perform actions on behalf of users.

## Quick Start

Here's a simple MCP tool that returns the current time:

```javascript
// Define the tool handler
function getCurrentTimeHandler(context) {
  const timezone = context.args.timezone || "UTC";
  const now = new Date();

  return {
    timestamp: now.toISOString(),
    timezone: timezone,
    formatted: now.toLocaleString("en-US", { timeZone: timezone }),
  };
}

// Register the tool in init()
function init(context) {
  const schema = {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "IANA timezone (e.g., 'America/New_York', 'Europe/London')",
        default: "UTC",
      },
    },
  };

  mcpRegistry.registerTool("getCurrentTime", {
    description: "Get the current date and time in a specified timezone",
    inputSchema: schema,
    handler: "getCurrentTimeHandler",
  });
}
```

## MCP Registry API

### `mcpRegistry.registerTool(name, { description, inputSchema, handler })`

Registers a new MCP tool that AI clients can discover and execute.

**Parameters:**

- `name` (string) - Unique identifier for the tool (e.g., "getCurrentTime")
- `description` (string) - Human-readable description of what the tool does
- `inputSchema` (object) - JSON Schema defining the tool's input parameters
- `handler` (string) - Name of the JavaScript function that handles tool execution

Answers `{ ok: true }`, or `{ ok: false, reason }` when the registration is refused (for example, a call outside `init()`); a malformed call throws.

**Example:**

```javascript
mcpRegistry.registerTool("calculate", {
  description: "Perform basic mathematical calculations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
        description: "Mathematical operation to perform",
      },
      a: { type: "number", description: "First operand" },
      b: { type: "number", description: "Second operand" },
    },
    required: ["operation", "a", "b"],
  },
  handler: "calculateHandler",
});
```

## Handler Functions

A tool handler receives the usual `context`: the arguments are in
`context.args`, and the person calling is in `context.request.auth` (an MCP
client calls `/mcp` with a bearer token, so a tool always knows who is
calling).

**Handler Requirements:**

1. Return plain data — an object, array, number or string — and the engine
   serializes it. Do not `JSON.stringify` it yourself: a returned string is
   expected to be JSON already.
2. **Throw an `Error` for a failure.** The client gets the message as a tool
   error (`isError: true`), which a model understands as "this did not work";
   an `{ error: ... }` object reads as a successful answer.
3. Every global is available (`fetch`, `database`, `scriptStorage`, ...), and
   the call runs with the caller's permissions.

**Example Handler:**

```javascript
function calculateHandler(context) {
  const { operation, a, b } = context.args;

  // Validate inputs
  if (isNaN(a) || isNaN(b)) {
    throw new Error("Invalid numbers provided");
  }

  // Perform calculation
  let result;
  switch (operation) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      if (b === 0) {
        throw new Error("Cannot divide by zero");
      }
      result = a / b;
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  return { operation, a, b, result };
}
```

## Input Schema (JSON Schema)

The input schema defines what parameters your tool accepts. It follows the [JSON Schema](https://json-schema.org/) specification.

**Common Schema Patterns:**

### Simple String Parameter

```javascript
{
  type: "object",
  properties: {
    location: {
      type: "string",
      description: "City name or location"
    }
  },
  required: ["location"]
}
```

### Enum (Limited Choices)

```javascript
{
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "xml", "csv"],
      description: "Output format"
    }
  }
}
```

### Number with Constraints

```javascript
{
  type: "object",
  properties: {
    count: {
      type: "number",
      description: "Number of items",
      minimum: 1,
      maximum: 100,
      default: 10
    }
  }
}
```

### Multiple Parameters

```javascript
{
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query"
    },
    limit: {
      type: "number",
      description: "Maximum results",
      default: 10
    },
    offset: {
      type: "number",
      description: "Results offset",
      default: 0
    }
  },
  required: ["query"]
}
```

## Calling External MCP Servers

The engine also exposes a global `McpClient` class for connecting to remote MCP servers from your own script code. Use this when you want one aiwebengine script to act as an MCP client to another MCP-compatible service. Its methods answer in values and throw when they fail; see the engine's `docs/MCP_CLIENT.md` for the whole contract.

### new McpClient(serverUrl, secretIdentifier)

- `serverUrl` must be an `https://` URL.
- `secretIdentifier` must name a secret that contains the remote server token or bearer credential.

```javascript
const client = new McpClient(
  "https://api.githubcopilot.com/mcp/",
  "GITHUB_TOKEN",
);
```

### client.listTools()

Answers the remote server's tools as an array of `{ name, description, inputSchema }`. The engine caches the list for one hour.

```javascript
for (const tool of client.listTools()) {
  console.log(`Remote tool: ${tool.name}`);
}
```

### client.callTool(name, args)

Calls a remote tool and answers its result. A JSON-RPC error from the server throws an `Error` carrying the server's `code`.

```javascript
try {
  const result = client.callTool("search_repositories", {
    query: "aiwebengine",
    limit: 5,
  });
} catch (error) {
  console.error(`Remote MCP tool failed [${error.code}]: ${error.message}`);
}
```

### Complete example

```javascript
function searchGitHubHandler(context) {
  const client = new McpClient(
    "https://api.githubcopilot.com/mcp/",
    "GITHUB_TOKEN",
  );
  return client.callTool("search_repositories", {
    query: context.args.query,
    limit: context.args.limit || 5,
  });
}
```

## Complete Example

Here's a complete script with multiple MCP tools:

```javascript
// Weather tool handler (simulated data)
function getWeatherHandler(context) {
  const location = context.args.location || "Unknown";

  const conditions = ["Sunny", "Cloudy", "Rainy", "Snowy"];
  const randomCondition =
    conditions[Math.floor(Math.random() * conditions.length)];
  const temperature = Math.floor(Math.random() * 30) + 10;

  return {
    location: location,
    condition: randomCondition,
    temperature: temperature,
    unit: "celsius",
    timestamp: new Date().toISOString(),
  };
}

// ID generator handler
function generateIdHandler(context) {
  const prefix = context.args.prefix || "id";
  const length = context.args.length || 8;

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomPart = "";
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return {
    id: prefix + "-" + randomPart,
    timestamp: Date.now(),
  };
}

// Initialize and register tools
function init(context) {
  console.log("Registering MCP tools...");

  // Register weather tool
  mcpRegistry.registerTool("getWeather", {
    description:
      "Get current weather information for a location (simulated data)",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or location",
        },
      },
      required: ["location"],
    },
    handler: "getWeatherHandler",
  });

  // Register ID generator tool
  mcpRegistry.registerTool("generateId", {
    description: "Generate a random unique identifier with optional prefix",
    inputSchema: {
      type: "object",
      properties: {
        prefix: {
          type: "string",
          description: "Prefix for the generated ID",
          default: "id",
        },
        length: {
          type: "number",
          description: "Length of the random part",
          default: 8,
          minimum: 4,
          maximum: 32,
        },
      },
    },
    handler: "generateIdHandler",
  });

  console.log("MCP tools registered");
}
```

## Using MCP Tools with AI Clients

An engine's MCP endpoint is `/mcp` on each host that publishes scripts (the
management host's `/mcp` also lists the engine's own tools). It is a remote
HTTP MCP server that signs people in with OAuth: a client discovers the
engine's authorization server, registers itself, and opens a browser for the
person to sign in and consent. Any client that supports remote MCP servers
with OAuth can use it.

### VS Code

**File: `.vscode/mcp.json`**

```json
{
  "servers": {
    "my-engine": {
      "type": "http",
      "url": "https://yourdomain.com/mcp"
    }
  }
}
```

### Claude

Add a custom connector with the URL `https://yourdomain.com/mcp`, or in
Claude Code: `claude mcp add --transport http my-engine https://yourdomain.com/mcp`.

### Testing with curl

`/mcp` accepts only a bearer token whose audience is that host's `/mcp`. With a
token (in a checkout with the repository tooling, `make oauth-login` stores
one):

```bash
# List available tools
curl -X POST https://yourdomain.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'

# Call a tool
curl -X POST https://yourdomain.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": { "name": "getWeather", "arguments": { "location": "Helsinki" } }
  }'
```

## Best Practices

### 1. Clear Tool Names

Use descriptive, action-oriented names:

✅ Good: `getCurrentTime`, `searchUsers`, `createDocument`  
❌ Bad: `time`, `users`, `doc`

### 2. Detailed Descriptions

Write clear descriptions that explain what the tool does and when to use it:

```javascript
mcpRegistry.registerTool("searchProducts", {
  description:
    "Search the product catalog by name, category, or SKU. Returns matching products with prices and availability.",
  inputSchema: schema,
  handler: "searchProductsHandler",
});
```

### 3. Comprehensive Schemas

Provide detailed parameter descriptions and constraints:

```javascript
{
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query - can be product name, category, or SKU"
    },
    minPrice: {
      type: "number",
      description: "Minimum price filter in USD",
      minimum: 0
    },
    maxPrice: {
      type: "number",
      description: "Maximum price filter in USD",
      minimum: 0
    }
  },
  required: ["query"]
}
```

### 4. Error Handling

Throw with a message that says what to do differently; the client shows it as
a tool error:

```javascript
function myToolHandler(context) {
  if (!context.args.required_param) {
    throw new Error("Missing required parameter: required_param");
  }
  return { result: doSomething(context.args.required_param) };
}
```

An uncaught exception from deeper code is reported the same way, and logged.

### 5. Use Existing APIs

Leverage other aiwebengine features in your tools:

```javascript
function searchDataHandler(context) {
  const query = context.args.query;

  // Use fetch to call external API
  const response = fetch(
    `https://api.example.com/search?q=${encodeURIComponent(query)}`,
  );
  const data = response.json();

  // Use scriptStorage to cache results
  scriptStorage.setItem(`search:${query}`, response.body);

  // Log the search
  console.log(`Search performed: ${query}`);

  return { query: query, results: data.results };
}
```

### 6. Return Structured Data

Return well-structured JSON that's easy for AI to interpret:

```javascript
// ✅ Good - structured and clear
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "metadata": {
    "timestamp": "2025-12-02T15:00:00Z"
  }
}

// ❌ Bad - unstructured text
"User John Doe (ID: 123, email: john@example.com) retrieved at 2025-12-02T15:00:00Z"
```

## Security Considerations

### Authentication

Registering a tool takes an editor who owns the script. Calling one takes a
signed-in person: `/mcp` refuses a request without a valid bearer token, and
the tool runs with that person's identity and permissions. Decide what they may
do from `context.request.auth` — never from an argument, which the caller
chooses:

```javascript
function deleteNoteHandler(context) {
  const auth = context.request.auth;
  const note = database.query("notes", { where: { id: context.args.id } })[0];
  if (!note || note.owner !== auth.userId) {
    throw new Error("No such note");
  }
  database.delete("notes", note.id);
  return { deleted: note.id };
}
```

### Input Validation

Always validate and sanitize inputs:

```javascript
function createUserHandler(context) {
  const { username, email } = context.args;

  // Validate username
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    throw new Error("Invalid username format");
  }

  // Validate email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email format");
  }

  // Create user
  return createUser(username, email);
}
```

### Rate Limiting

`rateLimit.consume` spends from a budget the engine keys to the caller:

```javascript
function expensiveOperationHandler(context) {
  const budget = rateLimit.consume("expensive", {
    limit: 10,
    windowSeconds: 60,
  });
  if (!budget.allowed) {
    throw new Error(
      `Rate limit exceeded; try again in ${budget.retryAfterSeconds}s`,
    );
  }
  return performExpensiveOperation();
}
```

A variable at the top of the script would not work: the program runs from the
top on every call.

## Troubleshooting

### Tool Not Appearing

If your tool doesn't appear in the tools list:

1. Read `registerTool`'s result, or run `check_script`: a refused registration says why
2. Check the script's log for `init()` errors
3. Check the client is connected to a host the script is published on
4. Ensure the schema is valid JSON Schema

### Tool Execution Fails

If tool execution fails:

1. Check the handler name matches exactly, and is a global of `main.*`
2. Look for errors in the script's log (`read_logs` with `kind=mcpTool`)
3. A handler that returns a string that is not JSON fails the call; return data
4. Test the handler in a `*.test.ts` file, calling it with a context you build

### Schema Validation Issues

If arguments aren't being passed correctly:

1. Ensure the schema matches JSON Schema specification
2. Check that property names in schema match what the handler expects
3. Verify required fields are specified
4. Test with simpler schema first

## Next Steps

- See the complete example in [`mcp_tools_demo`](https://github.com/lpajunen/aiwebengine-examples/tree/main/mcp_tools_demo)
- Learn about [JavaScript APIs](../reference/javascript-apis.md)
- Explore [AI-Assisted Development](ai-development.md)
- Check [Script Development Guide](scripts.md)

## Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [JSON Schema Documentation](https://json-schema.org/)
- [Example MCP Tools Script](https://github.com/lpajunen/aiwebengine-examples/tree/main/mcp_tools_demo)
