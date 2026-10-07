# Asset Management Guide

How to work with a script's files — stylesheets, client-side JavaScript,
images, documents — and how to serve them.

## How Files Work

A script is a tree of files stored in the engine's database. Its entrypoint is
`main.js` (or `main.ts`, `main.tsx`, `main.jsx`); every other file sits beside
it at a path such as `lib/util.ts`, `public/app.css` or `skills/faq.md`. There
is no directory on the server to copy files into.

Which files the world may reach is decided by directory:

| Directory     | Who can reach it                                                            |
| ------------- | --------------------------------------------------------------------------- |
| `public/`     | Anyone, once a file route in `init()` names the file                        |
| `resources/`  | MCP clients, once `init()` registers it with `mcpRegistry.registerResource` |
| anything else | Only the script itself (imports, `files.read`)                              |

Nothing is served automatically. A file is published at the path a **file
route** gives it:

```javascript
function init() {
  routeRegistry.registerRoute("/my-app/app.css", { file: "public/app.css" });
  routeRegistry.registerRoute("/my-app/logo.png", { file: "public/logo.png" });
}
```

A file route names one file; register one route per file you publish. The
engine sets the content type from the file's stored MIME type. A file route
serves the file as it is now, so changing the file needs no redeploy. See
[Serving Files: File Routes](asset-registration.md) for the details.

## Adding Files

### The web editor

1. Open `/editor` and switch to the **Assets** tab.
2. Choose the script.
3. **Upload** files from your computer, or **+ New** to create a text file.
   Give a file you want to serve a path under `public/`.

### From a checkout

In a repository that includes `scripts/tooling.mk`, a script is a directory:
`main.js` plus every other file under it, at the same relative path.
`make deploy-changed` writes what changed; see
[Deployment Workflow](../getting-started/03-deployment-workflow.md).

### From a script: `files`

`files` reads and writes the running script's own tree:

```javascript
// List this script's files
files.list().forEach((file) => {
  console.log(`${file.path}: ${file.size} bytes, ${file.mimetype}`);
});

// Read a text file (null if there is no such file)
const css = files.read("public/styles.css");

// Read a binary file as base64
const logoB64 = files.read("public/logo.png", { encoding: "base64" });

// Create or replace a file
files.write("public/new-image.png", base64EncodedContent, {
  encoding: "base64",
});

// Delete a file (true if it was there)
files.delete("public/old-image.png");
```

`files` cannot write the entrypoint (`main.*`). Every write is recorded as a
revision of the script. For content that only changes with a deploy, an import
is better than a read: `import policy from "./skills/refund.md"` gives the
file's text, cached with the program.

**Example: accept an upload.** A multipart form's files arrive in
`context.request.files`, already base64:

```javascript
function uploadHandler(context) {
  const req = context.request;
  if (!req.auth.isAuthenticated) {
    return ResponseBuilder.error(401, "Sign in to upload");
  }
  const upload = req.files[0];
  if (!upload || !upload.filename) {
    return ResponseBuilder.error(400, "No file in the form");
  }
  const name = upload.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = "public/uploads/" + name;

  try {
    files.write(path, upload.data, {
      encoding: "base64",
      mimetype: upload.contentType,
    });
  } catch (error) {
    return ResponseBuilder.error(400, error.message);
  }
  return ResponseBuilder.json({ path }, 201);
}

// Files written at runtime are served by a handler rather than a file route,
// since a file route names one file and is registered in init().
function serveUpload(context) {
  const path = "public/uploads/" + context.request.params.name;
  const data = files.read(path, { encoding: "base64" });
  if (data === null) return ResponseBuilder.error(404, "No such upload");
  const info = files.list().find((file) => file.path === path);
  return {
    status: 200,
    bodyBase64: data,
    contentType: info ? info.mimetype : "application/octet-stream",
  };
}

function uploadFormHandler(context) {
  return ResponseBuilder.html(`<!DOCTYPE html>
<html><body>
  <form method="POST" action="/my-app/upload" enctype="multipart/form-data">
    <input type="file" name="file" required>
    <button type="submit">Upload</button>
  </form>
</body></html>`);
}

function init() {
  routeRegistry.registerRoute("/my-app/upload", {
    handler: "uploadFormHandler",
  });
  routeRegistry.registerRoute("/my-app/upload", {
    handler: "uploadHandler",
    method: "POST",
  });
  routeRegistry.registerRoute("/my-app/uploads/:name", {
    handler: "serveUpload",
  });
}
```

A request body is bounded by the engine's upload limit, and a file by
10,000,000 bytes.

### Another script's files: engine operations

`files` reaches only the running script. To manage another script's files —
from a page, a deployment tool, or a script that builds other scripts — use the
engine's file operations: `list_files`, `read_file`, `write_file`,
`create_file`, `write_files`, `edit_file` and `delete_file`. Each is
`POST /engine/<operation>` with a JSON body on the management host (the
read-only ones also take `GET` with the arguments in the query), the MCP tool
of the same name, or `engine.call("<operation>", args)` from a script. The
engine answers as the signed-in person: an owner of the script or an
administrator gets through.

**List, or read one file:**

```bash
curl -H "Authorization: Bearer $TOKEN" "$MANAGE_HOST/engine/list_files?script=my-app"
curl -H "Authorization: Bearer $TOKEN" "$MANAGE_HOST/engine/read_file?script=my-app&path=public/app.css"
```

A read answers with `content` (text when `encoding` is `"utf8"`, base64
otherwise) and the file's `sha256`, `bytes` and `total_lines`. For a text file
you can ask for part of it:

| Parameter | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `lines`   | Inclusive 1-based line range: `120-180`, `120-` to the end, or `120` alone |
| `grep`    | Regular expression; answers with matching line numbers and their text      |

**Write one file** with `write_file` and `{ script, path, text }` (or `content`
as base64 for binary). `create_file` takes the same arguments and refuses a
path that is already taken.

**Write several at once** with `write_files`. Writing a script's modules one
request at a time makes the engine act on each partial state: every
single-file write reinitializes the script, on every instance of a cluster,
from a tree that is still being uploaded. One batch is one transaction, one
revision and one `init()`:

```json
{
  "script": "my-app",
  "files": [
    { "name": "lib/util.ts", "text": "export const RETRIES = 3;\n" },
    { "name": "public/logo.png", "content_base64": "iVBORw0KGgo..." },
    {
      "name": "public/app.css",
      "text": "body { margin: 0; }\n",
      "sha256": "..."
    }
  ],
  "remove": ["public/old.css"],
  "reinit": "after"
}
```

Up to 256 files and 10 MB of content per batch. `mimetype` is inferred from the
extension when omitted, and a `sha256` that does not match rejects the whole
batch. Nothing is written if any file is rejected. The answer carries a
`check` report — read its diagnostics first.

**Edit a file in place** with `edit_file`, sending only what changes:

```json
{
  "script": "my-app",
  "path": "lib/util.ts",
  "edits": [
    { "old_string": "RETRIES = 3", "new_string": "RETRIES = 5" },
    { "old_string": "log(", "new_string": "console.log(", "replace_all": true }
  ],
  "base_sha256": "<sha256 from read_file>"
}
```

Each `old_string` must be present, and unique unless `replace_all` is set; up
to 128 edits are checked together, and a patch that does not match writes
nothing. With `base_sha256`, the patch is refused if the file changed since it
was read.

**Delete** with `delete_file` and `{ script, path }`.

## Using Files in Pages

Link to the paths your file routes publish:

```javascript
function homeHandler(context) {
  return ResponseBuilder.html(`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/my-app/app.css">
</head>
<body>
  <img src="/my-app/logo.png" alt="Logo">
  <div id="app"></div>
  <script src="/my-app/app.js" defer></script>
</body>
</html>`);
}

function init() {
  routeRegistry.registerRoute("/my-app", { handler: "homeHandler" });
  routeRegistry.registerRoute("/my-app/app.css", { file: "public/app.css" });
  routeRegistry.registerRoute("/my-app/logo.png", { file: "public/logo.png" });
  routeRegistry.registerRoute("/my-app/app.js", { file: "public/app.js" });
}
```

Routes are shared by every script on a host and the first script to register a
path keeps it, so prefix your paths with something your own (here `/my-app`).

## Tips

- **Keep served files under `public/`, everything else out of it.** A module,
  a prompt or a data file outside `public/` cannot be served by mistake.
- **Version client files for caching**: `app.v2.js`, or `app.js?v=2`.
- **Images**: compress before uploading; a file is at most 10 MB.
- **Many files**: use `write_files` (or `make deploy-changed`) rather than one
  write per file.

## Troubleshooting

| Symptom                    | Check                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A file answers 404         | Is there a file route for that path in `init()`, and does it name a file that exists?                       |
| The file route was refused | The file must be under `public/`, and the path must not be held by another script. The refusal names which. |
| The wrong content type     | Upload with the right extension, or pass `mimetype` when writing.                                           |
| `files.read` throws        | A binary file needs `{ encoding: "base64" }`.                                                               |

## Next Steps

- **[Serving Files: File Routes](asset-registration.md)** - File routes in detail
- **[Script Development](scripts.md)** - Dynamic content
- **[API Reference](../reference/javascript-apis.md)** - `files` and every other global
