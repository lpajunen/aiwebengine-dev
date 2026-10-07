# Deployment Workflow

How a script gets from your editor to an engine, and how what the engine serves
is chosen. A script is a tree of files stored in the engine's database; its
entrypoint is `main.{ts,js,tsx,jsx}`, and its `init()` registers routes, tools
and jobs. Writing a script's files records a revision and re-runs `init()` —
there is no build step and no restart.

There are four ways to write files, and all of them reach the same engine
operations with the same permission checks:

| Way                        | Good for                                             |
| -------------------------- | ---------------------------------------------------- |
| The web editor (`/editor`) | Small scripts, learning, editing on a server         |
| The repository tooling     | Working in a local checkout with git                 |
| Git sync                   | Moving a solution between a repository and an engine |
| MCP / `/engine/*` directly | Agents and your own automation                       |

## The web editor

Open `/editor`, create a script, write its `main.js`, and save. Saving writes
the file and runs `init()`; the Logs tab shows what it logged.

```javascript
// main.js
function helloHandler(context) {
  return {
    status: 200,
    body: "Hello from the editor!",
    contentType: "text/plain",
  };
}

function init() {
  routeRegistry.registerRoute("/hello", {
    handler: "helloHandler",
    method: "GET",
  });
}
```

The engine calls `init()`; a script never calls it itself.

## The repository tooling

A repository built from this one (or including its `scripts/tooling.mk`)
deploys from a checkout. Sign in once, then deploy what changed:

```bash
make oauth-login                 # browser sign-in; the token is saved and refreshed
make deploy-changed-dry-run      # what would be written
make deploy-changed              # write the changed files, verified by sha256
```

`aiwebengine.config.json` says which directory is which script; `URI=` and
`FILES="..."` retarget a single run. `make upload-<name>` targets in a repository's
own `Makefile` deploy a whole script directory.

## Git sync

The engine can pull a GitHub repository in and push a script's files back as
one commit. A directory holding `main.*` is one script; everything beside it is
its files.

```bash
make set-git-credentials                       # store a token, checked against GitHub
make git-pull REPO=owner/repo [PREFIX=demo]    # repository → engine
make git-push REPO=owner/repo SCRIPT=demo-shop # engine → repository
```

A push refuses when both sides have moved since the last sync. See the engine's
`docs/GIT_SYNC.md`.

## Choosing what is served: pins

By default a script serves its newest revision (head), so every write is live.
Pin a script and writes keep recording revisions while production stays put:

```bash
make status                        # what is served vs. head
make pin                           # freeze what is running now
make deploy-changed                # write freely; production does not move
make check-head && make test-head  # vet the newest revision
make promote                       # serve it
make unpin                         # or follow head again
make revert REV=last-good          # put the files back as a new revision
```

The underlying operations are `deploy_script`, `get_deployment`,
`list_revisions`, `diff_revisions`, `label_revision` and `revert_script`.

## Checking a Script Before It Goes Live

Deploying to find out whether a script works is a slow loop, and a local `tsc`
cannot see what the engine will do with the code. Three endpoints run the
script the way the engine would, without publishing anything. All three answer
to an owner of the script or an Administrator.

### `POST /engine/check_script` — what would this script do if deployed?

`check` resolves the script's asset-backed imports the way the engine does,
runs its `init()` with **every registration withheld** and database writes
rolled back, and reports what it found:

```bash
# Check what is deployed
curl -X POST "$MANAGE_HOST/engine/check_script" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"script": "my-app"}'
```

```json
{
  "scriptUri": "my-app",
  "ok": true,
  "diagnostics": [],
  "init": {
    "ran": true,
    "durationMs": 12,
    "budgetMs": 10000,
    "timedOut": false
  },
  "registrations": [
    {
      "kind": "route",
      "name": "/things",
      "method": "GET",
      "handler": "listThings"
    }
  ],
  "timestamp": "2026-01-01T12:00:00Z"
}
```

`ok` is false when any diagnostic is an error. Each diagnostic is
`{file, line, severity, code, message}`, and they catch what type checking
cannot: import cycles the bundler rejects, a registration whose handler name is
not defined as a global, an `init()` running close to its deploy budget, and a
path another script already claims.

Pass `content` to check code **before writing it** — the script URI does not
even have to exist yet:

```bash
curl -X POST "$MANAGE_HOST/engine/check_script" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"script": "my-app", "content": "function init() { routeRegistry.registerRoute(\"/x\", { handler: \"handleX\", method: \"GET\" }); }"}'
```

`rollback` (default `true`) controls whether the database writes `init()` makes
are kept, and `timeoutMs` raises the ceiling for a slow `init()`.

### `POST /engine/eval_script` — try an expression in a deployed script's sandbox

`eval` loads the script's own program, evaluates a snippet against it, and
returns the value plus everything the snippet logged. The snippet can call the
script's functions, use the bindings its entrypoint imported, and `import` or
`require` any module the entrypoint reaches:

```bash
curl -X POST "$MANAGE_HOST/engine/eval_script" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"script": "my-app", "source": "database.query(\"things\")"}'
```

```json
{
  "scriptUri": "my-app",
  "ok": true,
  "value": "[]",
  "valueType": "string",
  "console": [],
  "durationMs": 19,
  "rolledBack": true,
  "timestamp": "2026-01-01T12:00:00Z"
}
```

The last expression is the value. Scripts run synchronously, so do not use
`async`/`await`. Database writes roll back unless you pass `rollback=false`,
and registrations do nothing — which is what makes this a safe way to inspect
data or try an expression instead of authoring, deploying and deleting a
throwaway script.

### `POST /engine/run_tests` — run the script's own tests

Test modules are the script's own assets named `*.test.ts` (or `.js`, `.jsx`,
`.tsx`), written with the `describe` / `test` / `expect` globals. `run_tests`
runs them and reports a verdict per case; `filter` runs only the cases whose
name contains a given string, and writes roll back by default.

Each of these has an equivalent MCP tool — `check_script`, `eval_script` and
`run_tests` — so an assistant working on a script can use the same loop.

The repository tooling wraps all three: `make check-head`, `make eval SRC='…'`,
`make test` and `make test-head`.

## Troubleshooting

- **A route answers 404 after a write.** `init()` failed or did not register
  it. `check_script` reports why; the script's log (`read_logs`) has the error.
- **A route answers with old behaviour.** The script is pinned. `make status`
  shows what is served.
- **A registration is refused.** Another script on the same host already holds
  the path, or a file route names a file outside `public/`. The refusal names
  which.
