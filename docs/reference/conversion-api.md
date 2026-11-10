# Conversion API Reference

The `convert` object provides functions for converting content between different formats: Markdown to HTML, Handlebars templates, and base64. Every function answers with its result and throws an `Error` when it fails.

## convert.markdown_to_html()

Converts a markdown string to HTML using the same high-quality parser used by the aiwebengine documentation system.

### Syntax

```javascript
const html = convert.markdown_to_html(markdown);
const trusted = convert.markdown_to_html(markdown, { html: true });
```

### Parameters

- **markdown** (string): The markdown content to convert
  - Maximum size: 1MB (1,000,000 bytes)
  - Cannot be empty
  - Supports standard CommonMark syntax plus extensions
- **options** (object, optional)
  - **html** (boolean, default `false`): pass raw HTML, every link and image
    URL, and heading attributes through as written. Only for Markdown you
    trust as much as your own code. Unknown keys throw a `TypeError`.

### Safe by default

Without `html: true` the result can go into a page whoever wrote the Markdown:

- Raw HTML (`<script>`, `<img onerror=…>`, `<div>`) comes out as text.
- A link or image whose URL is not `http:`, `https:`, `mailto:` or relative
  (a path, `#fragment`, `?query`) keeps only its text. `javascript:` and
  `data:` URLs are dropped, however they are spelled.
- Headings keep `{#id .class}`, but no other attributes.

### Return Value

The HTML as a string. A conversion that fails throws an `Error`.

### Supported Markdown Features

The converter supports GitHub-Flavored Markdown including:

- **Headings** (`#`, `##`, `###`, etc.)
- **Bold** (`**text**` or `__text__`)
- **Italic** (`*text*` or `_text_`)
- **Strikethrough** (`~~text~~`)
- **Code blocks** (```)
- **Inline code** (`` `code` ``)
- **Links** (`[text](url)`)
- **Images** (`![alt](url)`)
- **Lists** (ordered and unordered)
- **Tables** (with header rows and alignment)
- **Blockquotes** (`>`)
- **Task lists** (`- [ ]` and `- [x]`)
- **Footnotes**
- **Heading attributes**

### Error Handling

The function throws an `Error` if:

- Markdown input is empty
- Markdown input exceeds 1MB size limit
- An unexpected parsing error occurs

### Examples

#### Basic Conversion

```javascript
function renderMarkdownPage(context) {
  const req = context.request;

  const markdown = `# Welcome

This is a **simple** example with *italic* text.

## Features

- Easy to use
- Fast rendering
- GitHub-flavored markdown
`;

  let html;
  try {
    html = convert.markdown_to_html(markdown);
  } catch (error) {
    return {
      status: 500,
      body: error.message,
      contentType: "text/plain; charset=UTF-8",
    };
  }

  // Wrap in HTML page template
  const fullPage = `<!DOCTYPE html>
<html>
<head>
  <title>Markdown Page</title>
  <link rel="stylesheet" href="/engine/engine.css">
</head>
<body>
  <div class="container">
    ${html}
  </div>
</body>
</html>`;

  return {
    status: 200,
    body: fullPage,
    contentType: "text/html; charset=UTF-8",
  };
}
```

#### Blog Post from Storage

```javascript
function serveBlogPost(context) {
  const req = context.request;

  // Extract slug from path like /blog/my-post
  const slug = req.path.split("/").pop();

  // Load markdown from script storage
  const markdown = scriptStorage.getItem(`blog:${slug}`);

  if (!markdown) {
    return {
      status: 404,
      body: "Blog post not found",
      contentType: "text/plain; charset=UTF-8",
    };
  }

  // Convert markdown to HTML
  let content;
  try {
    content = convert.markdown_to_html(markdown);
  } catch (error) {
    console.error(`Failed to convert blog post ${slug}: ${error.message}`);
    return {
      status: 500,
      body: "Failed to render blog post",
      contentType: "text/plain; charset=UTF-8",
    };
  }

  // Create styled blog page
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Blog - ${slug}</title>
  <link rel="stylesheet" href="/engine/engine.css">
  <style>
    .blog-post {
      max-width: 800px;
      margin: 2rem auto;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .blog-post h1 { color: #333; }
    .blog-post code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .blog-post pre {
      background: #f4f4f4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="blog-post">
    ${content}
  </div>
</body>
</html>`;

  return {
    status: 200,
    body: html,
    contentType: "text/html; charset=UTF-8",
  };
}
```

#### Code Documentation with Syntax Highlighting

```javascript
function serveApiDocs(context) {
  const markdown = `# API Documentation

## Authentication

All API requests require a bearer token:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.example.com/data
\`\`\`

## Endpoints

### GET /api/users

Returns a list of users.

**Response:**

\`\`\`json
{
  "users": [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
  ]
}
\`\`\`

### POST /api/users

Creates a new user.

**Request Body:**

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| name  | string | Yes      | User's name |
| email | string | Yes      | User's email|

`;

  const html = convert.markdown_to_html(markdown);

  const page = `<!DOCTYPE html>
<html>
<head>
  <title>API Documentation</title>
  <link rel="stylesheet" href="/engine/engine.css">
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/docs">Docs</a>
  </nav>
  <main>
    ${html}
  </main>
</body>
</html>`;

  return {
    status: 200,
    body: page,
    contentType: "text/html; charset=UTF-8",
  };
}
```

#### User-Generated Content (Safe Rendering)

```javascript
function renderUserComment(context) {
  const req = context.request;

  // Get user-submitted markdown from form data
  const userMarkdown = req.form.comment || "";

  // Validate input size
  if (userMarkdown.length > 10000) {
    // 10KB limit for user comments
    return {
      status: 400,
      body: "Comment too long (max 10KB)",
      contentType: "text/plain; charset=UTF-8",
    };
  }

  // Convert markdown to HTML
  let commentHtml;
  try {
    commentHtml = convert.markdown_to_html(userMarkdown);
  } catch (error) {
    return {
      status: 400,
      body: "Invalid markdown: " + error.message,
      contentType: "text/plain; charset=UTF-8",
    };
  }

  // Safe to show: raw HTML is text and only safe links survive, because
  // this call does not pass { html: true }.

  return {
    status: 200,
    body: JSON.stringify({ html: commentHtml }),
    contentType: "application/json",
  };
}
```

## convert.render_handlebars_template()

Renders a Handlebars template with data.

```javascript
const html = convert.render_handlebars_template(
  "<h1>{{title}}</h1>{{#each items}}<li>{{this}}</li>{{/each}}",
  { title: "Hello", items: ["a", "b"] },
);
```

- **template** (string): the template, at most 1MB.
- **data** (object, or JSON text): the values the template refers to.

Answers the rendered string; a template that does not parse or render throws.

## convert.btoa() and convert.atob()

`convert.btoa(text)` answers the base64 encoding of a string's UTF-8 bytes, and
`convert.atob(base64)` decodes it back. Decoding input that is not base64, or
whose bytes are not UTF-8, throws.

## Performance Considerations

### Caching Converted HTML

Since markdown parsing is CPU-intensive, consider caching converted HTML for static content:

```javascript
function serveCachedDocs(context) {
  const req = context.request;
  const docId = req.query.id || "index";

  // Check cache first
  const cacheKey = `html:${docId}`;
  let html = scriptStorage.getItem(cacheKey);

  if (!html) {
    // Cache miss - load and convert markdown
    const markdown = scriptStorage.getItem(`markdown:${docId}`);

    if (!markdown) {
      return {
        status: 404,
        body: "Document not found",
        contentType: "text/plain; charset=UTF-8",
      };
    }

    // A failed conversion throws, so only a real result is cached
    html = convert.markdown_to_html(markdown);
    scriptStorage.setItem(cacheKey, html);
    console.info(`Cached HTML for document ${docId}`);
  }

  return {
    status: 200,
    body: wrapInTemplate(html),
    contentType: "text/html; charset=UTF-8",
  };
}

function wrapInTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Documentation</title>
  <link rel="stylesheet" href="/engine/engine.css">
</head>
<body>${content}</body>
</html>`;
}
```

### Invalidating Cache

```javascript
function updateDocument(context) {
  const req = context.request;
  const docId = req.form.id;
  const markdown = req.form.content;

  // Store new markdown
  scriptStorage.setItem(`markdown:${docId}`, markdown);

  // Invalidate HTML cache
  scriptStorage.removeItem(`html:${docId}`);

  return {
    status: 200,
    body: "Document updated",
    contentType: "text/plain; charset=UTF-8",
  };
}
```

## Security Notes

### XSS Prevention

By default the converter's output is safe to put in a page, whoever wrote the Markdown (see [Safe by default](#safe-by-default)). Still:

1. **`html: true` is for your own text only**: never pass it for Markdown a user, a feed or another script wrote
2. **Size Limits**: The converter enforces a 1MB limit, but you should set lower limits for user content
3. **Links still lead elsewhere**: an `https:` link to any site survives; it is a link, not script, but it can point anywhere
4. **CSP Headers**: Content-Security-Policy headers remain a good second layer

### Safe Usage Pattern

```javascript
function safeUserContent(context) {
  const req = context.request;
  const userMarkdown = req.form.content || "";

  // Validate input
  if (userMarkdown.length > 5000) {
    return { status: 400, body: "Content too long" };
  }

  // Convert
  let html;
  try {
    html = convert.markdown_to_html(userMarkdown);
  } catch (error) {
    return { status: 400, body: error.message };
  }

  // Return with strict CSP
  return {
    status: 200,
    body: html,
    contentType: "text/html; charset=UTF-8",
    headers: {
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline';",
    },
  };
}
```

## See Also

- [JavaScript APIs Reference](javascript-apis.md) - Complete API reference
- [Storage APIs](javascript-apis.md#storage-apis) - For caching converted HTML
- [HTTP Response Format](javascript-apis.md#http-response-format) - Response structure
