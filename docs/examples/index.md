# Example Scripts

Working examples live in the
[aiwebengine-examples](https://github.com/lpajunen/aiwebengine-examples)
repository. Each top-level directory holding `main.*` is one script; the files
beside it are its files. Pull them into an engine with git sync:

```bash
make git-pull REPO=lpajunen/aiwebengine-examples PREFIX=demo
```

or deploy one from a checkout of that repository with its `make` targets.

| Script                                                           | Shows                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `hello`                                                          | The smallest script: one route                               |
| `welcome`                                                        | A static welcome page                                        |
| `blog`                                                           | An HTML page with styling                                    |
| `markdown_blog`                                                  | Rendering Markdown files with `convert`                      |
| `feedback`                                                       | A form: GET renders it, POST handles it                      |
| `file-upload`                                                    | Multipart uploads                                            |
| `fetch_example`                                                  | Outbound `fetch`                                             |
| `chat_app`                                                       | A JSON API plus a per-channel Server-Sent Events stream      |
| `dbtest`                                                         | A script's own table, described in `init()`                  |
| `transaction-demo`                                               | `database.transaction(fn)`                                   |
| `transaction-tests`                                              | Commit, rollback and savepoint behaviour, one route each     |
| `auth_roles_demo`                                                | Reading the signed-in user and their roles                   |
| `mcp_tools_demo`                                                 | Registering MCP tools                                        |
| `mcp_prompts_demo`                                               | Registering MCP prompts                                      |
| `github_mcp_issues`                                              | `McpClient` against GitHub's MCP server                      |
| `typescript`, `jsx`, `tsx`                                       | Entrypoints in TypeScript and JSX                            |
| `import_example`                                                 | Importing a script's own modules                             |
| `meeting-bingo`, `meetup-planner`, `joke-page`, `daily-aphorism` | Small complete apps                                          |
| `virtual-world`                                                  | A large multi-module application (Three.js, streams, tables) |

The API every example uses is in [JavaScript APIs](../reference/javascript-apis.md).
A minimal script and the request/response shapes are in
[Your First Script](../getting-started/01-first-script.md) and
[Script Development](../guides/scripts.md).
