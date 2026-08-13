# Solution Developer Documentation

Welcome! This documentation helps you build applications, APIs, and features on aiwebengine.

## 🚀 Quick Start

**New to aiwebengine?** Start here:

1. **[Your First Script](getting-started/01-first-script.md)** - Create and deploy your first script (15 minutes)
2. **[Working with the Editor](getting-started/02-working-with-editor.md)** - Master the browser-based development environment
3. **[Deployment Workflow](getting-started/03-deployment-workflow.md)** - Learn different ways to deploy your scripts

After completing these guides, you'll be able to create, test, and deploy scripts confidently.

## 📚 Documentation Structure

### Getting Started (New Developers)

Perfect for beginners who want a guided learning path:

| Guide                                                                 | Description                                             | Time   |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| [01 - First Script](getting-started/01-first-script.md)               | Create a "Hello World" script and understand the basics | 15 min |
| [02 - Working with Editor](getting-started/02-working-with-editor.md) | Use the web editor for development and testing          | 20 min |
| [03 - Deployment Workflow](getting-started/03-deployment-workflow.md) | Deploy scripts using different methods                  | 15 min |

### Core Guides (Main Topics)

Deep dives into specific development areas:

| Guide                                                    | What You'll Learn                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [Script Development](guides/scripts.md)                  | Create handlers, register routes, manage state, error handling   |
| [MCP Tools Development](guides/mcp-tools.md)             | Create AI-discoverable tools using Model Context Protocol        |
| [MCP Prompts Development](guides/mcp-prompts.md)         | Create reusable templates for AI-assisted code generation        |
| [Asset Management](guides/assets.md)                     | Upload and serve images, CSS, JavaScript, and other static files |
| [Logging & Debugging](guides/logging.md)                 | Write logs, debug issues, monitor script behavior                |
| [Streaming & Real-time](guides/streaming.md)             | Build real-time features with Server-Sent Events                 |
| [GraphQL Subscriptions](guides/graphql-subscriptions.md) | Real-time data updates with GraphQL                              |
| [AI-Assisted Development](guides/ai-development.md)      | Use AI to generate, edit, and debug scripts                      |

### Tools & Workflows

Learn about development tools:

| Tool                                      | Purpose                              |
| ----------------------------------------- | ------------------------------------ |
| [Web Editor](tools/editor.md)             | Browser-based IDE with AI assistant  |
| [Deployer Tool](tools/deployer.md)        | CLI tool for rapid deployment        |
| [External Tools](tools/external-tools.md) | VS Code, Git, and other integrations |

### API Reference (Quick Lookup)

Complete API documentation:

| Reference                                       | Content                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [JavaScript APIs](reference/javascript-apis.md) | Routes, assets, storage, secrets, database, scheduler, GraphQL, fetch, ResponseBuilder |
| [Authentication API](reference/auth-api.md)     | Request auth context, plus user & role management (`userStorage`)                      |
| [Conversion API](reference/conversion-api.md)   | Markdown, Handlebars, and base64 helpers (`convert.*`)                                 |

The [JavaScript APIs](reference/javascript-apis.md) page is the single reference
for the runtime globals — it covers **storage** (`sharedStorage`,
`personalStorage`), **secrets** (`secretStorage`), the **database**, the
**scheduler** (`schedulerService`), GraphQL, `fetch`, and `ResponseBuilder`.

### Examples & Patterns

Real-world code examples:

| Examples                                             | What's Included                          |
| ---------------------------------------------------- | ---------------------------------------- |
| [Example Scripts Index](examples/index.md)           | Complete guide to all example scripts    |
| [Basic APIs](examples/basic-api.md)                  | Simple REST endpoints and JSON responses |
| [Forms & Data](examples/forms-and-data.md)           | Form handling and data processing        |
| [Real-time Features](examples/real-time-features.md) | Chat, notifications, live updates        |
| [AI Integration](examples/ai-integration.md)         | Using AI assistants and external AI APIs |

## 🎯 Find What You Need

### I want to...

**Create my first script**
→ Start with [Your First Script](getting-started/01-first-script.md)

**Build a REST API**
→ See [Script Development](guides/scripts.md) and [Basic API Examples](examples/basic-api.md)

**Create a web page**
→ Check [Script Development](guides/scripts.md) and [Forms & Data Examples](examples/forms-and-data.md)

**Add images and CSS**
→ Read [Asset Management](guides/assets.md)

**Build real-time features**
→ Learn [Streaming](guides/streaming.md) and see [Real-time Examples](examples/real-time-features.md)

**Create MCP tools for AI**
→ Follow [MCP Tools Development](guides/mcp-tools.md)

**Create MCP prompts for AI**
→ Follow [MCP Prompts Development](guides/mcp-prompts.md)

**Debug my script**
→ Use [Logging Guide](guides/logging.md)

**Use AI to help code**
→ Follow [AI-Assisted Development](guides/ai-development.md)

**Deploy to production**
→ Check [Deployment Workflow](getting-started/03-deployment-workflow.md)

**See working examples**
→ Browse [Example Scripts](examples/index.md)

**Look up a function**
→ Search [JavaScript APIs](reference/javascript-apis.md)

## 💡 Common Scenarios

### Scenario 1: Building a Blog

1. Read [Script Development](guides/scripts.md) to understand handlers
2. Create scripts for:
   - Homepage (list posts)
   - Post detail page
   - Admin interface (create/edit posts)
3. Add [CSS assets](guides/assets.md) for styling
4. Use [Logging](guides/logging.md) for debugging
5. Deploy with [Deployer Tool](tools/deployer.md)

### Scenario 2: Creating a REST API

1. Start with [Basic API Examples](examples/basic-api.md)
2. Follow [Script Development](guides/scripts.md) for CRUD operations
3. Add [Authentication](reference/auth-api.md) if needed
4. Use [Logging](guides/logging.md) for monitoring
5. Test with [Web Editor](tools/editor.md)

### Scenario 3: Real-time Dashboard

1. Learn [Streaming](guides/streaming.md) basics
2. Check [Real-time Examples](examples/real-time-features.md)
3. Create dashboard with [HTML/CSS assets](guides/assets.md)
4. Use [AI Assistant](guides/ai-development.md) to generate code
5. Monitor with [Logging](guides/logging.md)

### Scenario 4: Form-based Application

1. See [Forms & Data Examples](examples/forms-and-data.md)
2. Learn form handling in [Script Development](guides/scripts.md)
3. Add validation and error handling
4. Style with [Assets](guides/assets.md)
5. Test in [Web Editor](tools/editor.md)

## 📖 Learning Paths

### Path 1: Complete Beginner (Recommended)

1. [Your First Script](getting-started/01-first-script.md) ⏱️ 15 min
2. [Working with Editor](getting-started/02-working-with-editor.md) ⏱️ 20 min
3. [Basic API Examples](examples/basic-api.md) ⏱️ 15 min
4. [Script Development](guides/scripts.md) ⏱️ 30 min
5. [Asset Management](guides/assets.md) ⏱️ 20 min
6. [Deployment Workflow](getting-started/03-deployment-workflow.md) ⏱️ 15 min

**Total time:** ~2 hours

### Path 2: Experienced Developer (Fast Track)

1. [Your First Script](getting-started/01-first-script.md) ⏱️ 10 min
2. [JavaScript APIs Reference](reference/javascript-apis.md) ⏱️ 10 min
3. [Example Scripts](examples/index.md) ⏱️ 15 min
4. [Deployment Workflow](getting-started/03-deployment-workflow.md) ⏱️ 10 min
5. Build your project! ⏱️ ∞

**Total time:** ~45 minutes

### Path 3: AI-First Development

1. [AI-Assisted Development](guides/ai-development.md) ⏱️ 20 min
2. [Working with Editor](getting-started/02-working-with-editor.md) ⏱️ 15 min
3. Use AI to generate scripts! ⏱️ ∞
4. Reference [JavaScript APIs](reference/javascript-apis.md) as needed

**Total time:** ~35 minutes + development

## 🛠️ Development Workflows

### Browser-Based Development

1. Open `/editor` in browser
2. Create or edit scripts
3. Save (auto-reloads)
4. Test immediately
5. View logs in real-time

**Best for:** Quick prototyping, learning, remote development

### Local Development with Deployer

1. Write scripts in your favorite editor (VS Code, etc.)
2. Test locally with deployer
3. Commit to Git
4. Deploy to production

**Best for:** Professional development, version control, teams

### AI-Assisted Development

1. Describe what you want to the AI
2. Review generated code
3. Apply with one click
4. Test and iterate

**Best for:** Rapid development, learning, experimentation

## 📝 Quick Reference

### Essential Functions

```javascript
// Route registration
routeRegistry.registerRoute(path, handlerName, method);

// Logging
console.log(message);
const logs = JSON.parse(console.listLogs()); // admins and script owners

// Assets (returns JSON metadata)
const assetsJson = assetStorage.listAssets();
const assets = JSON.parse(assetsJson);
const assetContent = assetStorage.fetchAsset(name);

// HTTP requests
const response = fetch(url, options);

// Streaming
routeRegistry.registerStreamRoute(path);
routeRegistry.sendStreamMessage(path, data);

// Response builders (preferred over hand-built response objects)
ResponseBuilder.json(data, status); // application/json
ResponseBuilder.text(text, status); // text/plain
ResponseBuilder.html(html, status); // text/html
ResponseBuilder.error(status, message); // JSON error body
ResponseBuilder.redirect(location); // 302 redirect
ResponseBuilder.noContent(); // 204
```

### Handler Template

Handlers receive a single `context` argument (the HTTP request is
`context.request`) and return a response. Use `ResponseBuilder` helpers to build
responses — they set the status and `Content-Type` for you:

```javascript
function myHandler(context) {
  const req = context.request;
  try {
    // Extract parameters
    const param = req.query.param;

    // Validate
    if (!param) {
      return ResponseBuilder.error(400, "Missing parameter");
    }

    // Process
    const result = process(param);

    // Return success
    return ResponseBuilder.json({ result: result });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return ResponseBuilder.error(500, "Internal error");
  }
}

function init() {
  routeRegistry.registerRoute("/my-endpoint", "myHandler", "GET");
}

init();
```

## 🔗 Related Resources

- **Example Scripts** - Browse working examples in the [Example Scripts Index](examples/index.md)
- **Web Editor** - Explore and edit deployed scripts and assets at `/editor`
- **API Reference** - Look up available functions in [JavaScript APIs](reference/javascript-apis.md)

## 🆘 Getting Help

- **Search this documentation** - Use browser's search (Cmd+F / Ctrl+F)
- **Check examples** - See [Example Scripts](examples/index.md)
- **Use AI assistant** - Built into `/editor`
- **GitHub Issues** - Report bugs or request features
- **API Reference** - Look up functions in [JavaScript APIs](reference/javascript-apis.md)

## 🎓 Additional Resources

- **[Example Scripts Index](examples/index.md)** - Guided tour of the example scripts
- **[Basic API Examples](examples/basic-api.md)** - Simple REST endpoints and JSON responses
- **[AI Integration Examples](examples/ai-integration.md)** - Using AI assistants and external AI APIs

---

**Ready to start building?** Begin with [Your First Script](getting-started/01-first-script.md)! 🚀
