# Example Scripts Reference

This guide documents the example JavaScript scripts maintained in the dedicated examples repository. These working examples demonstrate how to create solutions for aiwebengine, from simple HTML pages to interactive forms and real-time features.

**Script Location**: All example scripts live in the [aiwebengine-examples](https://github.com/lpajunen/aiwebengine-examples) repository under `src/<name>/<name>.js`.

## How to Upload Scripts

### Via HTTP API

```bash
# Upload a script
curl -X POST http://localhost:3000/api/scripts \
  -F "uri=https://example.com/my-script" \
  -F "content=<script_content>"
```

### Via the Built-in Editor

1. Open the editor at `http://localhost:3000/editor`
2. Navigate to the Scripts tab
3. Click "New Script"
4. Paste your JavaScript code
5. Save the script

## Available Examples

### blog.js

- **Endpoint**: `/blog`
- **Method**: GET
- **Description**: Serves a sample blog post about aiwebengine capabilities with modern styling
- **Features**: HTML templating, CSS styling, feature showcase

### feedback.js

- **Endpoints**: `/feedback`
- **Methods**: GET (form), POST (submission)
- **Description**: A complete feedback form with rating system and submission handling
- **Features**: Form handling, POST data processing, HTML responses, logging

## Script Structure

Each script follows this basic pattern:

```javascript
// Define handler functions
function my_handler(context) {
  const req = context.request;
  // Process the request
  // req contains: path, method, query, form, etc.

  return {
    status: 200, // HTTP status code
    body: "response", // Response content
    contentType: "text/html", // Optional content type
  };
}

// Register routes
routeRegistry.registerRoute("/my-endpoint", "my_handler", "GET");
routeRegistry.registerRoute("/my-endpoint", "my_handler", "POST");
```

## Request Object

The `req` parameter contains:

- `path`: The request path
- `method`: HTTP method (GET, POST, etc.)
- `query`: Query parameters object
- `form`: Form data object (for POST requests)
- `headers`: Request headers

## Response Object

Return an object with:

- `status`: HTTP status code (required)
- `body`: Response content (required)
- `contentType`: MIME type (optional, defaults to "text/plain; charset=UTF-8")

## Built-in Functions

- `routeRegistry.registerRoute(path, handlerFunction, method)`: Register a route
- `routeRegistry.registerStreamRoute(path)`: Register a Server-Sent Events stream
- `routeRegistry.sendStreamMessage(path, data)`: Broadcast to all stream connections
- `routeRegistry.sendStreamMessageFiltered(path, data, filterJson)`: Broadcast to filtered connections
- `console.log(message)`: Write to the server log
- `JSON.stringify(obj)`: Convert objects to JSON strings

## Testing the Examples

1. Start the aiwebengine server
2. Upload the example scripts via the editor or API
3. Visit `http://localhost:3000/blog` to see the blog
4. Visit `http://localhost:3000/feedback` to test the feedback form

These examples demonstrate the power and flexibility of aiwebengine's JavaScript execution environment!

## More Resources

- **[Deployer Tool Guide](deployer.md)** - Learn how to use the deployer for rapid development
- **[JavaScript APIs](../reference/javascript-apis.md)** - Complete API reference
- **[Your First Script](../getting-started/01-first-script.md)** - Full development guide
- **[Actual Script Files](https://github.com/lpajunen/aiwebengine-examples/tree/main/src)** - View the source code
