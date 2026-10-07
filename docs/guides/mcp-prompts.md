# MCP Prompts Guide

How to publish MCP (Model Context Protocol) prompts from a script: reusable
templates an AI client fills in with arguments and hands to the model.

## Table of Contents

- [Quick Start](#quick-start)
- [What are MCP Prompts?](#what-are-mcp-prompts)
- [Registering Prompts](#registering-prompts)
- [The Handler](#the-handler)
- [Testing Prompts](#testing-prompts)
- [Best Practices](#best-practices)
- [Example: Form Handler Generator](#example-form-handler-generator)

## Quick Start

```javascript
function createRestEndpoint(context) {
  const { resourceName, method } = context.arguments;
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Write an aiwebengine handler for ${method} /${resourceName}. ` +
            `Register it in init() with routeRegistry.registerRoute, validate ` +
            `the input, answer with ResponseBuilder.json, and store rows with ` +
            `database.insert / database.query.`,
        },
      },
    ],
  };
}

function init() {
  mcpRegistry.registerPrompt("create_rest_endpoint", {
    description: "Write a REST endpoint for an aiwebengine script",
    arguments: [
      {
        name: "resourceName",
        description: "The resource name (e.g., 'users', 'products')",
        required: true,
      },
      {
        name: "method",
        description: "HTTP method (GET, POST, PUT, DELETE)",
        required: true,
      },
    ],
    handler: "createRestEndpoint",
  });
}
```

## What are MCP Prompts?

A prompt is a named template the person picks in their AI client (often as a
slash command). The client asks for the arguments, calls `prompts/get`, and
puts the messages your handler returns into the conversation.

| Feature     | **Tools**                                 | **Prompts**                                       |
| ----------- | ----------------------------------------- | ------------------------------------------------- |
| Who invokes | The model decides to call it              | The person picks it                               |
| Returns     | Data                                      | Conversation messages                             |
| Use for     | Reading or changing data, running actions | Reusable instructions, workflows, starting points |

## Registering Prompts

```javascript
mcpRegistry.registerPrompt(name, { description, arguments, handler });
```

- `name` (string): 1-100 characters
- `description` (string): what the prompt is for, 1-1000 characters
- `arguments` (array, optional): `{ name, description?, required? }` each
- `handler` (string): the name of a global function of `main.*`

Register only in `init()`. The call answers `{ ok: true }` or
`{ ok: false, reason }`. Registering takes an editor who owns the script, and a
script's prompts are replaced each time its `init()` runs.

## The Handler

The handler is called with `{ mode, arguments }` — not the request context the
other handlers receive — and runs as the person calling.

**Prompt mode** (`prompts/get`): `context.mode === "prompt"`, and
`context.arguments` holds what the person filled in. Answer
`{ messages: [...] }`, each `{ role: "user" | "assistant", content: { type:
"text", text } }`. Throw an `Error` when the arguments are unusable.

**Completion mode** (`completion/complete`, an autocomplete while the person
types an argument): `context.mode === "completion"`, with
`completingArgument`, `partialValue` and the `arguments` given so far. Answer
`{ values: [...], total?, hasMore? }`.

```javascript
function createRestEndpoint(context) {
  if (context.mode === "completion") {
    if (context.completingArgument === "method") {
      const values = ["GET", "POST", "PUT", "DELETE"].filter((m) =>
        m.startsWith(context.partialValue.toUpperCase()),
      );
      return { values, total: values.length, hasMore: false };
    }
    return { values: [] };
  }

  const { resourceName, method } = context.arguments;
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
    throw new Error("method must be GET, POST, PUT or DELETE");
  }
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Write an aiwebengine handler for ${method} /${resourceName}.`,
        },
      },
    ],
  };
}
```

A prompt can read the script's own data to build its messages — a project's
conventions from a file, recent items from a table:

```javascript
import conventions from "./resources/conventions.md";

function reviewChecklist(context) {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review this change against our conventions:\n\n${conventions}`,
        },
      },
    ],
  };
}
```

## Testing Prompts

`/mcp` takes a bearer token whose audience is that host's `/mcp` (in a
checkout with the repository tooling, `make oauth-login` stores one).

```bash
# List prompts
curl -X POST https://example.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "prompts/list"}'

# Get one, filled in
curl -X POST https://example.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "prompts/get",
    "params": {
      "name": "create_rest_endpoint",
      "arguments": { "resourceName": "products", "method": "GET" }
    }
  }'

# Complete an argument
curl -X POST https://example.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "completion/complete",
    "params": {
      "ref": { "type": "ref/prompt", "name": "create_rest_endpoint" },
      "argument": { "name": "method", "value": "P" }
    }
  }'
```

The completion answers:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "completion": { "values": ["POST", "PUT"], "total": 2, "hasMore": false }
  }
}
```

In VS Code, add the engine to `.vscode/mcp.json` and the prompts appear as
slash commands in chat:

```json
{
  "servers": {
    "aiwebengine": { "type": "http", "url": "https://example.com/mcp" }
  }
}
```

A handler can also be tested without MCP: call it from a `*.test.ts` file with
`{ mode: "prompt", arguments: {...} }` and check the messages.

## Best Practices

1. **Describe the outcome** in `description`: "Write a REST endpoint with
   validation and a database table", not "Makes an endpoint".
2. **Name and describe each argument**, with an example:
   `"Comma-separated field names (e.g., 'name, email, message')"`.
3. **Offer completions** for arguments with a known set of values.
4. **Validate in prompt mode, never in completion mode**: a half-typed
   argument is not an error.
5. **Ask for working code in the engine's idiom** — handlers named in
   `init()`, `ResponseBuilder`, `database` — when the prompt generates code,
   so the result runs without translation.

## Example: Form Handler Generator

```javascript
function createFormHandler(context) {
  if (context.mode === "completion") return { values: [] };

  const { formName, fields, submitPath } = context.arguments;
  const fieldList = fields
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (fieldList.length === 0) throw new Error("fields is empty");

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Write an aiwebengine script with a "${formName}" form.`,
            `GET ${submitPath} serves an HTML form with the fields: ${fieldList.join(", ")}.`,
            `POST ${submitPath} reads context.request.form, answers 400 naming any missing field,`,
            `and stores the submission with database.insert in a table created by`,
            `database.ensureTable in init(). Register both routes in init().`,
          ].join("\n"),
        },
      },
    ],
  };
}

function init() {
  mcpRegistry.registerPrompt("create_form_handler", {
    description: "Write a script serving an HTML form and storing submissions",
    arguments: [
      {
        name: "formName",
        description: "Form name (e.g., 'contact', 'registration')",
        required: true,
      },
      {
        name: "fields",
        description: "Comma-separated fields (e.g., 'name, email, message')",
        required: true,
      },
      {
        name: "submitPath",
        description: "Path of the form (e.g., '/contact')",
        required: true,
      },
    ],
    handler: "createFormHandler",
  });
}
```

## See Also

- [MCP Tools Guide](mcp-tools.md) - Tools for actions
- [Quick Start Guide](../getting-started/01-first-script.md) - Your first script
- [JavaScript API Reference](../reference/javascript-apis.md) - Full API documentation
- [`mcp_prompts_demo`](https://github.com/lpajunen/aiwebengine-examples/tree/main/mcp_prompts_demo) - A working example
