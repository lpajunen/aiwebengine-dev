# Working with the Web Editor

The editor at `/editor` is a browser page for creating and changing scripts,
their files and secrets, and for watching logs and routes. It is itself a
script (`editor` in this repository), using the engine's operations as the
signed-in person, so it can do only what that person may: an editor works with
the scripts they own, an administrator with every script.

## Accessing the Editor

```text
http://localhost:3000/editor
```

Sign in first; the editor needs the editor or administrator role. On a server
it is on the management host (`server.management_hosts`).

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ aiwebengine        📚 Documentation  ✏️ Editor  📖 Swagger   │
├──────────────────────────────────────────────────────────────┤
│ Scripts │ Assets │ Secrets │ Logs │ Routes                    │
├────────────┬─────────────────────────────────────────────────┤
│ Scripts [+ New]│ hello                       [Save] [Delete] │
│ [All ▾]    │ Owners: you            [Manage Owners]          │
│  hello     │                                                 │
│  blog      │          Monaco code editor (main.js)           │
├────────────┴─────────────────────────────────────────────────┤
│ 🤖 AI Assistant                                    [Submit]  │
├──────────────────────────────────────────────────────────────┤
│ Ready                                            [Test API]  │
└──────────────────────────────────────────────────────────────┘
```

| Tab         | What it does                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Scripts** | Lists scripts (all, or only yours), edits a script's `main.js`, shows and manages its owners, creates and deletes scripts          |
| **Assets**  | A script's other files: pick the script, then create (`+ New`), upload, edit text files, or delete                                 |
| **Secrets** | A script's secrets: pick the script, then `+ New`. A value is encrypted and never shown again; scripts use it as `{{secret:name}}` |
| **Logs**    | Log lines from the scripts you can read, newest at the bottom, refreshed every 5 seconds while the tab is open                     |
| **Routes**  | The routes registered on the engine; a route can be tried from here                                                                |

## Creating a Script

1. On the **Scripts** tab, click **+ New**.
2. Enter a name: lower-case letters, digits, `-` and `_` (for example
   `todo-api`). The name is the script, not a file; its entrypoint is
   `main.js`.
3. The editor writes a starter that registers `GET /<name>`. Replace it with
   your code and click **Save** (or Cmd+S / Ctrl+S).

Every save is a revision of the script, and the engine runs the script's
`init()` again, so the new routes answer at once. An earlier revision can be
restored with `make revert` from a checkout, or the `revert_script` tool.

## Files of a Script

A script is a tree of files. `main.js` is edited on the Scripts tab; every
other file is on the **Assets** tab.

Which files the world may reach is decided by directory: files under
`public/` may be served by a file route, files under `resources/` may be MCP
resources, everything else is private to the script. A file is served only at
the path a file route gives it:

```javascript
function init() {
  routeRegistry.registerRoute("/todo-api/logo.png", {
    file: "public/logo.png",
  });
}
```

See [Serving Files: File Routes](../guides/asset-registration.md).

## Testing

- **Test API** (bottom right) asks for a path, sends a `GET` to it and shows
  the answer.
- On the **Routes** tab, each route can be tried the same way (also as a
  `GET`).
- For anything else — a `POST`, headers, a body — use `curl` or the browser's
  developer tools.
- A script's own tests (`*.test.js` / `*.test.ts` files) run with `make test`
  from a checkout, or the `run_tests` tool.

## The AI Assistant

The panel at the bottom sends your prompt, together with the selected script or
file, to Claude. It answers with an explanation, or with a proposed change to a
script or file, shown as a diff that you **Apply** or **Reject**. Nothing is
written until you apply it.

The assistant needs an Anthropic API key stored as a secret named
`anthropic_api_key` on the `editor` script (Secrets tab). Without it the panel
answers that the key is not configured.

Specific prompts work best: "Add a `POST /todo-api/items` route that validates
`title` and stores items in a database table" rather than "make a todo app".

## Troubleshooting

| Symptom                                | Check                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A save is refused                      | The name and ownership: you can change only scripts you own unless you are an administrator. The status bar gives the reason. |
| A route answers 404                    | The Logs tab for `init()` errors, and the Routes tab: another script may already hold that path.                              |
| A route answers 500                    | The Logs tab. The most common cause is a handler that is not a top-level function of `main.js`.                               |
| A file is not served                   | It must be under `public/`, and a file route in `init()` must name it.                                                        |
| The AI Assistant says no key is stored | Store `anthropic_api_key` on the `editor` script.                                                                             |

## Next Steps

1. **[Learn Deployment Workflows](03-deployment-workflow.md)** - Working from a checkout, revisions and pinning
2. **[Master Script Development](../guides/scripts.md)** - Deep dive into script features
3. **[Explore AI Development](../guides/ai-development.md)** - Building scripts with an AI agent
4. **[See Examples](../examples/index.md)** - Study real-world patterns
