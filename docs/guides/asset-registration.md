# Asset Registration System

## Overview

As of November 2025, aiwebengine has been refactored to use a more flexible asset registration system. Assets are now:

1. **Stored by name** in the repository (not by HTTP path)
2. **Registered to HTTP paths at runtime** with a file route: `routeRegistry.registerRoute(path, { file })`
3. **Managed through JavaScript** in init() functions, similar to route registration

## Key Changes

### Before (Old System)

- Assets stored with `public_path` (e.g., `/logo.svg`)
- HTTP path was fixed in the database
- No flexibility to change paths without database updates

### After (New System)

- Assets stored with `asset_name` (e.g., `logo.svg`)
- HTTP paths registered dynamically using `routeRegistry.registerRoute(path, { file })`
- Same asset can be served at multiple HTTP paths
- Paths can be changed without touching the database

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

## Database Schema

The assets table structure:

```sql
CREATE TABLE assets (
    asset_name TEXT PRIMARY KEY,        -- Asset identifier
    mimetype TEXT NOT NULL,              -- MIME type
    content BYTEA NOT NULL,              -- Binary content
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
```

HTTP path mappings are maintained in-memory and registered via JavaScript.
