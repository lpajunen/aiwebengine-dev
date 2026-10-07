# aiwebengine-dev

![Status](https://img.shields.io/badge/status-experimental-orange)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue)

> ⚠️ **This project is experimental and a work in progress.** APIs and features may change without notice.

Documentation and tooling for AI Web Engine solution developers. This repository provides developer tools, type definitions, scripts, and comprehensive documentation for building solutions with the AI Web Engine platform.

## What is AI Web Engine?

AI Web Engine ([aiwebengine](https://github.com/lpajunen/aiwebengine)) runs JavaScript/TypeScript scripts — websites, HTTP APIs, MCP tools and agents — stored in the engine itself. This repository contains:

- `editor/`, `admin/` and `docs/` — the scripts serving `/editor`, `/admin` and `/docs` on an engine
- `docs/*.md` — the solution developer documentation, which `/docs` serves
- `scripts/` and `scripts/tooling.mk` — the shared deployment tooling (OAuth login, deploying changed files, revisions, tests, git sync)
- `types/` — the engine's type definitions, fetched with `make fetch-types`

## Prerequisites

- Node.js (v18 or higher)
- npm
- curl (for fetching resources)
- Access to an AI Web Engine server instance

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/lpajunen/aiwebengine-dev.git
   cd aiwebengine-dev
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   make install
   ```

3. Configure your environment:

   ```bash
   cp .env.example .env
   # Edit .env to configure your server settings
   ```

## Environment Configuration

Copy [.env.example](.env.example) to `.env` and configure the following variables:

- `SERVER_HOST` - The engine's default host for deployed solutions (default: `https://softagen.com`); individual scripts can be bound elsewhere with `make set-script-hosts`
- `MANAGE_HOST` - Where the engine management API (`/engine/...`), MCP endpoint (`/mcp`) and OAuth discovery are served (default: `https://manage.softagen.com`)
- `OAUTH_ISSUER` - OAuth discovery base (defaults to `MANAGE_HOST`)
- `OAUTH_CLIENT_ID` - Your OAuth client ID (optional, can use dynamic registration)
- `OAUTH_SCOPE` - OAuth scope (default: `openid`)

See [.env.example](.env.example) for all available configuration options.

## Usage

### Fetch Type Definitions

```bash
make fetch-types
```

### OAuth Login

Authenticate with your AI Web Engine server:

```bash
make oauth-login
```

### Deploy the Editor, Admin and Docs Scripts

```bash
make upload-all            # or upload-editor, upload-admin, upload-docs
```

### Set Script Hosts

After deploying the admin, editor and docs scripts, publish them on the management host
(`MANAGE_HOST`, default `manage.softagen.com`). Requires administrator privileges:

```bash
make set-script-hosts-dry-run   # preview
make set-script-hosts
```

Pass `--hosts` to target something else (`*` for every configured host, empty for the engine
default host):

```bash
node scripts/set-script-hosts.js --script-uri docs --hosts softagen.com
```

## Documentation

Comprehensive documentation is available in the [docs](docs) directory:

- **Getting Started**: [docs/getting-started](docs/getting-started)
- **Guides**: [docs/guides](docs/guides)
- **Examples**: [docs/examples](docs/examples)
- **API Reference**: [docs/reference](docs/reference)

An engine serves them at `/docs` once the `docs` script is deployed (`make upload-docs`).

## Contributing

Contributions are welcome! This is an open source project and we're learning together. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for reporting instructions.

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Maintainer

- Lasse Pajunen ([@lpajunen](https://github.com/lpajunen))
