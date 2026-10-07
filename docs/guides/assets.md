# Asset Management Guide

Learn how to work with static files like images, CSS, JavaScript, and other assets in aiwebengine.

Current engine versions store assets by name and expose them over HTTP after you register a file route with `routeRegistry.registerRoute(path, { file })`. Use `files` to manage file contents and the route registry to choose public URLs; only files under `public/` may be served.

## Overview

Assets are static files that your scripts can serve to clients. They can include:

- **Images** - PNG, JPEG, GIF, SVG
- **Stylesheets** - CSS files
- **Scripts** - Client-side JavaScript
- **Documents** - PDF, text files
- **Fonts** - WOFF, TTF files
- **Any other static content**

## How Assets Work

### Automatic Serving

aiwebengine automatically serves files from the `assets/` directory:

```text
assets/logo.png       → http://yourserver.com/logo.png
assets/style.css      → http://yourserver.com/style.css
assets/app.js         → http://yourserver.com/app.js
assets/docs/guide.pdf → http://yourserver.com/docs/guide.pdf
```

The server automatically:

- Sets correct MIME types based on file extensions
- Handles HTTP GET requests for assets
- Serves files efficiently

### Directory Structure

Organize assets in subdirectories:

```text
assets/
├── css/
│   ├── main.css
│   └── theme.css
├── js/
│   ├── app.js
│   └── utils.js
├── images/
│   ├── logo.png
│   └── banner.jpg
├── fonts/
│   └── custom.woff2
└── docs/
    └── manual.pdf
```

## Managing Assets

### Method 1: Web Editor (Easiest)

**Upload assets via the editor:**

1. Open `http://localhost:3000/editor`
2. Click "Assets" in sidebar
3. Click "Upload Assets"
4. Select files from your computer
5. Assets are immediately available

**View assets:**

- Browse in the Assets section
- Preview images directly
- Download or delete as needed

**Example: Upload a stylesheet**

1. Create `style.css` locally:

   ```css
   body {
     font-family: Arial, sans-serif;
     max-width: 800px;
     margin: 0 auto;
     padding: 20px;
   }
   ```

2. Upload via editor
3. Use in your scripts:

   ```javascript
   function pageHandler(context) {
     return {
       status: 200,
       body: `
         <!DOCTYPE html>
         <html>
         <head>
           <link rel="stylesheet" href="/css/style.css">
         </head>
         <body>
           <h1>Styled Page</h1>
         </body>
         </html>
       `,
       contentType: "text/html",
     };
   }
   ```

### Method 2: Direct File Placement

**Copy files to the assets directory:**

```bash
# Copy a single file
cp logo.png /path/to/aiwebengine/assets/

# Copy directory structure
cp -r public/* /path/to/aiwebengine/assets/

# Using rsync
rsync -av local-assets/ server:/path/to/aiwebengine/assets/
```

Files are immediately available at their URLs.

### Method 3: API-Based (Programmatic)

**Use `files`, the script's own tree:**

```javascript
// List this script's files
files.list().forEach((file) => {
  console.log(`${file.path}: ${file.size} bytes, ${file.mimetype}`);
});

// Read a text file (null if there is no such file)
const css = files.read("public/styles.css");

// Read a binary file as base64
const logoB64 = files.read("public/logo.png", { encoding: "base64" });

// Create or update a file
files.write("public/new-image.png", base64EncodedContent, {
  encoding: "base64",
});

// Delete a file (true if it was there)
files.delete("public/old-image.png");
```

**Example: Upload from form**

```javascript
function uploadHandler(context) {
  const req = context.request;
  const assetName = "public/" + req.form.name; // "public/uploads-file.jpg"
  const mimetype = req.form.mimetype; // "image/jpeg"
  const contentB64 = req.form.content; // Base64 string

  try {
    files.write(assetName, contentB64, { encoding: "base64", mimetype });
    console.log(`Asset uploaded: ${assetName}`);

    return {
      status: 201,
      body: JSON.stringify({
        message: "Asset uploaded",
        assetName: assetName,
      }),
      contentType: "application/json",
    };
  } catch (error) {
    console.error(`Upload failed: ${error.message}`);
    return {
      status: 500,
      body: JSON.stringify({ error: "Upload failed" }),
      contentType: "application/json",
    };
  }
}

routeRegistry.registerRoute("/upload-asset", {
  handler: "uploadHandler",
  method: "POST",
});
```

### Method 4: The engine's HTTP API (`/engine/{operation}`)

`files` works on the files of the script that is running. To manage
another script's assets — from a page, a deployment tool, or a script that
builds other scripts — call the engine's file operations (`list_files`, `read_file`, `write_file`, `write_files`, `edit_file`, `delete_file`), each `POST /engine/{operation}` with a JSON body (the read-only ones also take `GET` with the arguments in the query). A file is named by its `path` within the script, and a script's entrypoint is the file named `main.ts` (or `.js`, `.tsx`, `.jsx`). The engine answers as the
signed-in user, so an owner of the script, a user with the asset capability, or
an Administrator gets through and everyone else is refused.

**List, or read one asset:**

```javascript
const script = encodeURIComponent("my-app");

// Every file the script owns
const list = await (await fetch(`/engine/list_files?script=${script}`)).json();

// One file: `content` is text when `encoding` is "utf8", base64 otherwise
const file = await (
  await fetch(`/engine/read_file?script=${script}&path=app.css`)
).json();
```

A read carries the `sha256`, `bytes` and `total_lines` of the whole asset
alongside its content. For a text asset you can ask for part of it instead of
transferring the file:

| Parameter | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `lines`   | Inclusive 1-based line range: `120-180`, `120-` to the end, or `120` alone |
| `grep`    | Regular expression; answers with matching line numbers and their text      |

```javascript
// Lines 120-180 as text, not base64
const range = await (
  await fetch(
    `/engine/read_file?script=${script}&path=lib/util.ts&lines=120-180`,
  )
).json();
// { encoding, content, start_line, end_line, sha256, bytes, total_lines, ... }

// Where is renderCart defined?
const hits = await (
  await fetch(
    `/engine/read_file?script=${script}&path=lib/util.ts&grep=function%20renderCart`,
  )
).json();
// { encoding, matches: [{ line, text, truncated }], match_count, sha256, ... }
```

**Write one file** with `POST /engine/write_file` and `{ script, path, text }` (or `content` as base64 for binary), the HTTP form of `files.write` for any script you may write. `create_file` takes the same body and refuses a path that is already taken.

**Write several at once** with `/engine/write_files`. A script's modules
are one unit of change, and writing them one request at a time makes the engine
act on each partial state: every single-asset write invalidates the prepared
program and notifies the rest of the cluster, so every other instance
reinitializes the script once per file, each time from a tree that is still
being uploaded. One batch is one transaction, one notification, and one
`init()`:

```javascript
const result = await (
  await fetch(`/engine/write_files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: "my-app",
      files: [
        { name: "lib/util.ts", content_base64: utilB64 },
        {
          name: "lib/cart.ts",
          content_base64: cartB64,
          mimetype: "text/plain",
        },
        { name: "app.css", content_base64: cssB64, sha256: cssSha },
      ],
      reinit: "after", // or "never" to leave init() alone
    }),
  })
).json();
```

Up to 256 files and 10 MB of content per batch. `mimetype` is inferred from the
extension when omitted, and a `sha256` that does not match the decoded content
rejects the whole batch. Nothing is written if any file is rejected.

**Edit an asset in place** with `/engine/edit_file` — the point of it is what
is _not_ in the request. A caller changing three lines sends those three lines,
not the module:

```javascript
const patched = await (
  await fetch(`/engine/edit_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      script: "my-app",
      path: "lib/util.ts",
      edits: [
        { old_string: "const RETRIES = 3;", new_string: "const RETRIES = 5;" },
        { old_string: "log(", new_string: "console.log(", replace_all: true },
      ],
      base_sha256: file.sha256,
    }),
  })
).json();
// { sha256, bytes, replacements, init: { ... } }
```

Each `old_string` must be present, and unique unless `replace_all` is set; up
to 128 edits are checked and applied in memory before anything is stored, so a
patch that does not match writes nothing and answers `400`. `base_sha256` is
the precondition: pass the `sha256` a read reported and the patch is refused
with `409` if the stored content has moved on since — a change to a known
version rather than to whatever happens to be there.

**Delete** with `POST /engine/delete_file` and `{ script, path }`.

Every one of these has an equivalent MCP tool (`list_files`, `read_file`,
`write_file`, `write_files`, `edit_file`, `delete_file`), which is how an
AI assistant edits a script's modules without resending them.

## Using Assets in Scripts

### Linking Stylesheets

```javascript
function styledPageHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Page</title>
      <!-- Link to CSS assets -->
      <link rel="stylesheet" href="/css/main.css">
      <link rel="stylesheet" href="/css/theme.css">
    </head>
    <body>
      <h1>Styled Content</h1>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}
```

### Loading JavaScript

```javascript
function appPageHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>App</title>
    </head>
    <body>
      <div id="app"></div>
      
      <!-- Load JavaScript assets -->
      <script src="/js/utils.js"></script>
      <script src="/js/app.js"></script>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}
```

### Embedding Images

```javascript
function galleryHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Gallery</h1>
      
      <!-- Reference image assets -->
      <img src="/images/logo.png" alt="Logo">
      <img src="/images/banner.jpg" alt="Banner">
      <img src="/images/icon.svg" alt="Icon">
      
      <!-- Background images via CSS -->
      <div style="
        background-image: url('/images/background.jpg');
        height: 300px;
      ">
        Content
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
```

### Referencing Documents

```javascript
function resourcesHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Resources</h1>
      
      <!-- Links to documents -->
      <ul>
        <li><a href="/docs/manual.pdf">User Manual (PDF)</a></li>
        <li><a href="/docs/guide.txt">Quick Guide (Text)</a></li>
        <li><a href="/downloads/template.zip">Template (ZIP)</a></li>
      </ul>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}
```

## Asset Organization Patterns

### By Type

```text
assets/
├── css/
├── js/
├── images/
├── fonts/
└── docs/
```

**Pros:** Clear separation, easy to find
**Cons:** Mixed purposes in same category

### By Feature

```text
assets/
├── home/
│   ├── hero.jpg
│   ├── home.css
│   └── home.js
├── dashboard/
│   ├── dashboard.css
│   └── dashboard.js
└── shared/
    ├── common.css
    └── logo.png
```

**Pros:** Related assets together
**Cons:** Harder to find all CSS files

### Hybrid Approach

```text
assets/
├── global/
│   ├── css/
│   ├── js/
│   └── images/
├── features/
│   ├── blog/
│   ├── shop/
│   └── auth/
└── vendor/
    ├── bootstrap.css
    └── jquery.js
```

**Pros:** Best of both worlds
**Cons:** More complex structure

## Dynamic Asset Management

### Asset Gallery Script

```javascript
function assetGalleryHandler(context) {
  // Get all assets with metadata
  // Every image this script serves from public/
  const images = files
    .list()
    .filter(
      (file) =>
        file.path.startsWith("public/") && file.mimetype.startsWith("image/"),
    );

  // Build HTML gallery
  const imageCards = images
    .map((asset) => {
      return `
      <div class=\"image-card\">
        <img src=\"/${asset.name}\" alt=\"${asset.name}\">
        <p>${asset.name} (${Math.round(asset.size / 1024)}KB)</p>
      </div>
    `;
    })
        <img src="${path}" alt="${path}">
        <p>${path}</p>
      </div>
    `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Asset Gallery</title>
      <style>
        .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
        .image-card { border: 1px solid #ddd; padding: 10px; }
        .image-card img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      <h1>Asset Gallery</h1>
      <div class="gallery">
        ${imageCards}
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

routeRegistry.registerRoute("/assets-gallery", { handler: "assetGalleryHandler", method: "GET" });
```

### Asset Upload Form

```javascript
function uploadFormHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Upload Asset</title>
    </head>
    <body>
      <h1>Upload Asset</h1>
      <form id="uploadForm">
        <label>
          File Path (e.g., /images/photo.jpg):
          <input type="text" id="path" required>
        </label><br>
        
        <label>
          File:
          <input type="file" id="file" required>
        </label><br>
        
        <button type="submit">Upload</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const path = document.getElementById('path').value;
          const file = document.getElementById('file').files[0];
          
          // Read file as base64
          const reader = new FileReader();
          reader.onload = async function(e) {
            const base64 = e.target.result.split(',')[1];
            
            // Send to server
            const response = await fetch('/api/upload-asset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: path,
                mimetype: file.type,
                content: base64
              })
            });
            
            const result = await response.json();
            document.getElementById('result').innerHTML = 
              response.ok 
                ? '<p style="color: green;">Upload successful!</p>' 
                : '<p style="color: red;">Upload failed: ' + result.error + '</p>';
          };
          reader.readAsDataURL(file);
        });
      </script>
    </body>
    </html>
  `;

  return {
    status: 200,
    body: html,
    contentType: "text/html",
  };
}

routeRegistry.registerRoute("/upload-form", {
  handler: "uploadFormHandler",
  method: "GET",
});
```

## Asset API Reference

### `files.list()`

Every file of the script, sorted by path.

```javascript
files.list();
// [
//   {
//     "path": "public/logo.png",
//     "size": 1024,
//     "mimetype": "image/png",
//     "createdAt": 1768732500000,
//     "updatedAt": 1768732500000
//   },
//   { ... }
// ]
```

### `files.read(path, options?)`

The file as text, or as base64 with `{ encoding: "base64" }`. Answers `null`
when there is no such file, and throws for a binary file read as text.

```javascript
const logoB64 = files.read("public/logo.png", { encoding: "base64" });
```

### `files.write(path, content, options?)`

Creates or replaces a file. `content` is text, or base64 with
`{ encoding: "base64" }`; the MIME type comes from the extension unless
`{ mimetype }` is given.

```javascript
files.write("public/new.png", "iVBORw0KGgoAAAANS...", { encoding: "base64" });
```

### `files.delete(path)`

Removes a file. Answers `true`, or `false` when there was nothing to remove.

```javascript
files.delete("public/old-image.png");
```

## MIME Types Reference

Common MIME types for assets:

### Images

```javascript
"image/jpeg"; // .jpg, .jpeg
"image/png"; // .png
"image/gif"; // .gif
"image/svg+xml"; // .svg
"image/webp"; // .webp
"image/x-icon"; // .ico
```

### Stylesheets & Scripts

```javascript
"text/css"; // .css
"application/javascript"; // .js
"application/json"; // .json
```

### Documents

```javascript
"application/pdf"; // .pdf
"text/plain"; // .txt
"text/html"; // .html
"text/markdown"; // .md
```

### Fonts

```javascript
"font/woff"; // .woff
"font/woff2"; // .woff2
"font/ttf"; // .ttf
"font/otf"; // .otf
```

### Archives

```javascript
"application/zip"; // .zip
"application/gzip"; // .gz
"application/x-tar"; // .tar
```

## Best Practices

### 1. Organize Consistently

Choose an organization pattern and stick to it:

```text
assets/
├── css/
├── js/
└── images/
```

### 2. Use Descriptive Names

**Good:**

- `header-logo.png`
- `main-stylesheet.css`
- `user-profile-default.jpg`

**Bad:**

- `img1.png`
- `style.css`
- `pic.jpg`

### 3. Optimize Assets

- Compress images before uploading
- Minify CSS and JavaScript
- Use appropriate formats (WebP for images, WOFF2 for fonts)

### 4. Version Assets

Include versions in filenames for cache busting:

```text
app.v1.js → app.v2.js
style-2024-01.css
```

Or use query parameters:

```html
<script src="/app.js?v=2"></script>
```

### 5. Clean Up Unused Assets

Regularly remove assets that are no longer referenced:

```javascript
function cleanupHandler(context) {
  const unusedAssets = findUnusedAssets(files.list());

  unusedAssets.forEach((file) => {
    files.delete(file.path);
    console.log(`Deleted unused file: ${file.path}`);
  });

  return {
    status: 200,
    body: JSON.stringify({
      deleted: unusedAssets.length,
    }),
    contentType: "application/json",
  };
}
```

## Common Patterns

### Responsive Images

```javascript
function responsiveImageHandler(context) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <!-- Responsive image with srcset -->
      <img 
        src="/images/photo-800.jpg"
        srcset="
          /images/photo-400.jpg 400w,
          /images/photo-800.jpg 800w,
          /images/photo-1200.jpg 1200w
        "
        sizes="(max-width: 600px) 400px, 800px"
        alt="Photo"
      >
    </body>
    </html>
  `;

  return { status: 200, body: html, contentType: "text/html" };
}
```

### CSS Themes

```javascript
function themedPageHandler(context) {
  const req = context.request;
  const theme = req.query.theme || "light";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="/css/base.css">
      <link rel="stylesheet" href="/css/theme-${theme}.css">
    </head>
    <body>
      <h1>Themed Page</h1>
    </body>
    </html>
  `;

  return { status: 200, body: html, contentType: "text/html" };
}
```

### Progressive Web App (PWA)

```javascript
function pwaManifestHandler(context) {
  const manifest = {
    name: "My App",
    short_name: "App",
    icons: [
      { src: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    start_url: "/",
    display: "standalone",
    theme_color: "#ffffff",
    background_color: "#ffffff",
  };

  return {
    status: 200,
    body: JSON.stringify(manifest),
    contentType: "application/json",
  };
}

routeRegistry.registerRoute("/manifest.json", {
  handler: "pwaManifestHandler",
  method: "GET",
});
```

## Troubleshooting

### Asset Not Loading

**Check:**

- File exists in `assets/` directory
- Path is correct (case-sensitive)
- MIME type is correct
- No typos in URL

### Images Not Displaying

**Check:**

- Image format is supported
- File is not corrupted
- Path starts with `/`
- Browser console for errors

### CSS Not Applied

**Check:**

- `<link>` tag in `<head>`
- Correct `href` path
- CSS syntax is valid
- Browser cache (try hard refresh: Ctrl+F5)

### JavaScript Not Running

**Check:**

- `<script>` tag placement (before closing `</body>` or with `defer`)
- Console for JavaScript errors
- Correct `src` path

## Next Steps

- **[Script Development](scripts.md)** - Learn to create dynamic content
- **[Logging Guide](logging.md)** - Debug asset issues
- **[Examples](../examples/index.md)** - See asset usage in practice
- **[API Reference](../reference/javascript-apis.md)** - Complete API docs

## Quick Reference

```javascript
// List this script's files: each has path, size, mimetype, createdAt, updatedAt
const all = files.list();

// Read text, or base64 for binary (null if missing)
const css = files.read("public/styles.css");
const logoB64 = files.read("public/logo.png", { encoding: "base64" });

// Create or update
files.write("public/new.png", base64Content, { encoding: "base64" });

// Delete
files.delete("public/old.png");
```

Another script's assets, over the engine's HTTP API:

```javascript
const script = encodeURIComponent("my-app");

// List, read a whole asset, read a line range, or search it
await fetch(`/engine/list_files?script=${script}`);
await fetch(`/engine/read_file?script=${script}&path=app.css`);
await fetch(
  `/engine/read_file?script=${script}&path=lib/util.ts&lines=120-180`,
);
await fetch(
  `/engine/read_file?script=${script}&path=lib/util.ts&grep=renderCart`,
);

// Write many files as one transaction and one init()
await fetch(`/engine/write_files`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    script: "my-app",
    files: [{ name: "app.css", content_base64: cssB64 }],
  }),
});

// Change a few lines without resending the file
await fetch(`/engine/edit_file`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    script: "my-app",
    path: "lib/util.ts",
    edits: [{ old_string: "RETRIES = 3", new_string: "RETRIES = 5" }],
    base_sha256: sha,
  }),
});
```
