# Serving Files: File Routes

A script's files are stored by their path in the script's tree. A file is
served over HTTP only when the script's `init()` registers a **file route** for
it, and only from `public/`:

- the HTTP path is chosen at registration, so it need not mirror the file
  path, and one file can be served at several paths;
- the file is read when a request arrives, so rewriting it needs no
  re-registration;
- a file anywhere but `public/` is private to the script, and a route naming
  one is refused.

## Asset Functions

### routeRegistry.registerRoute(path, { file, authorize? })

Registers an HTTP path to serve one file of the script's tree.

**Spec:**

- `file` (string): the file's path in the tree. It must be under `public/` —
  a file's directory is what says whether the world may read it, so
  publishing a file means moving it there.
- `authorize` (string, optional): name of the function that decides who may
  read the file. It answers `{ deny: 401 }` (or any 4xx) to refuse and any
  other object to allow. Without one, the file is served to anyone who can
  reach the host.
- `summary`, `description`, `tags` (optional): OpenAPI documentation.

`path` must start with `/` (max 500 characters); `:param` and a trailing `/*`
work.

**Example:**

```javascript
function init(context) {
  routeRegistry.registerRoute("/logo.svg", { file: "public/logo.svg" });
  routeRegistry.registerRoute("/editor.css", { file: "public/editor.css" });
  routeRegistry.registerRoute("/invoice.pdf", {
    file: "public/invoice.pdf",
    authorize: "mayReadInvoice",
  });
}
```

## Best Practices

1. **Register in init()**: Always register file routes in your script's `init()` function
2. **Use descriptive names**: Asset names should be descriptive (e.g., `logo.svg`, `main.css`)
3. **Organize paths**: Use logical HTTP paths (e.g., `/css/`, `/js/`, `/images/`)
4. **One asset, multiple paths**: You can serve the same asset at multiple HTTP paths
5. **Served files live in `public/`**: a file anywhere else is private to the script and is refused

## Error Handling

A mistake in the call **throws**:

- Path doesn't start with `/`, or is too long (>500 characters)
- The file path is empty, too long (>255 characters) or contains `..` or `\`
- The caller lacks the `WriteAssets` capability

A **refusal** is returned as `{ ok: false, reason }`, so one bad path does not
cost the script its other registrations:

- The file is not in the script's tree
- The file is not under `public/`
- The call was made outside `init()`

**Example with error checking:**

```javascript
function init(context) {
  const result = routeRegistry.registerRoute("/logo.svg", {
    file: "public/logo.svg",
  });
  if (!result.ok) {
    console.error("logo not published: " + result.reason);
  }
}
```
