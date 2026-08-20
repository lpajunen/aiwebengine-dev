.PHONY: all fetch-types fetch-openapi fetch-graphql-schema oauth-login upload-editor upload-editor-dry-run upload-docs upload-docs-dry-run upload-admin upload-admin-dry-run set-script-hosts set-script-hosts-dry-run install outdated format format-check lint typecheck verify

# Host configuration (can be overridden via environment variables)
# SERVER_HOST serves deployed solutions and OAuth; MANAGE_HOST serves the
# engine management API (/engine/...) and MCP (/mcp).
export SERVER_HOST ?= https://softagen.com
export MANAGE_HOST ?= https://manage.softagen.com

# Default target: fetch types, OpenAPI, and GraphQL schema
all:
	npm run all

fetch-types:
	npm run fetch-types

fetch-openapi:
	npm run fetch-openapi

fetch-graphql-schema:
	npm run fetch-graphql-schema

oauth-login:
	npm run oauth-login

upload-editor:
	npm run upload-editor

upload-editor-dry-run:
	npm run upload-editor-dry-run

upload-docs:
	npm run upload-docs

upload-docs-dry-run:
	npm run upload-docs-dry-run

upload-admin:
	npm run upload-admin

upload-admin-dry-run:
	npm run upload-admin-dry-run

# Publish admin, editor and docs on MANAGE_HOST (run after deploying them)
set-script-hosts:
	npm run set-script-hosts

set-script-hosts-dry-run:
	npm run set-script-hosts-dry-run

install:
	npm run install

outdated:
	npm run outdated

format:
	npm run format

format-check:
	npm run format-check

lint:
	npm run lint

typecheck:
	npm run typecheck

verify:
	npm run verify
