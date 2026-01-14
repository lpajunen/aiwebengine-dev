# aiwebengine-dev

![Status](https://img.shields.io/badge/status-experimental-orange)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue)

> ⚠️ **This project is experimental and a work in progress.** APIs and features may change without notice.

Documentation and tooling for AI Web Engine solution developers. This repository provides developer tools, type definitions, scripts, and comprehensive documentation for building solutions with the AI Web Engine platform.

## What is AI Web Engine?

AI Web Engine is a platform for building AI-powered web applications with JavaScript. This repository contains the development toolkit including:

- TypeScript type definitions for the AI Web Engine APIs
- OAuth authentication helpers
- GraphQL schema fetching utilities
- Comprehensive documentation and examples
- Deployment tools

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

- `SERVER_HOST` - Your AI Web Engine server URL (default: `https://softagen.com`)
- `OAUTH_CLIENT_ID` - Your OAuth client ID (optional, can use dynamic registration)
- `OAUTH_SCOPE` - OAuth scope (default: `openid`)

See [.env.example](.env.example) for all available configuration options.

## Usage

### Fetch Type Definitions

```bash
npm run fetch-types
# or
make fetch-types
```

### OAuth Login

Authenticate with your AI Web Engine server:

```bash
npm run oauth-login
# or
make oauth-login
```

### Fetch GraphQL Schema

Download the GraphQL schema for introspection:

```bash
npm run fetch-graphql-schema
# or
make fetch-graphql-schema
```

## Documentation

Comprehensive documentation is available in the [src/docs](src/docs) directory:

- **Getting Started**: [src/docs/assets/getting-started](src/docs/assets/getting-started)
- **Guides**: [src/docs/assets/guides](src/docs/assets/guides)
- **Examples**: [src/docs/assets/examples](src/docs/assets/examples)
- **API Reference**: [src/docs/assets/reference](src/docs/assets/reference)

To serve the documentation locally, run the documentation system via the docs.js script.

## Contributing

Contributions are welcome! This is an open source project and we're learning together. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for reporting instructions.

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Maintainer

- Lasse Pajunen ([@lpajunen](https://github.com/lpajunen))
