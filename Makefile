# Repository-specific targets. Everything generic lives in scripts/tooling.mk,
# which is a verbatim copy of the shared tooling: `make check-tooling` reports
# drift against TOOLING_SOURCE, `make sync-tooling` takes its version.
# Per-script defaults live in aiwebengine.config.json.

.PHONY: all upload-editor upload-editor-dry-run upload-docs upload-docs-dry-run \
        upload-admin upload-admin-dry-run upload-all \
        set-script-hosts set-script-hosts-dry-run

# Fetch types and OpenAPI, then format.
all: fetch-types fetch-openapi format

include scripts/tooling.mk

# admin, editor and docs are served from the management host, not from
# SERVER_HOST, so the binding below names it explicitly.
MANAGE_HOSTNAME = $(shell echo "$(MANAGE_HOST)" | sed -e 's|^https\{0,1\}://||' -e 's|/.*$$||')

# Each script is its directory: main.js plus every other file under it as
# assets, at the same relative path.
upload-editor:
	@node scripts/upload-script.js --script-path editor/main.js \
	  --script-uri editor --assets-dir editor

upload-editor-dry-run:
	@node scripts/upload-script.js --script-path editor/main.js \
	  --script-uri editor --assets-dir editor --dry-run

upload-docs:
	@node scripts/upload-script.js --script-path docs/main.js \
	  --script-uri docs --assets-dir docs

upload-docs-dry-run:
	@node scripts/upload-script.js --script-path docs/main.js \
	  --script-uri docs --assets-dir docs --dry-run

upload-admin:
	@node scripts/upload-script.js --script-path admin/main.js \
	  --script-uri admin --assets-dir admin

upload-admin-dry-run:
	@node scripts/upload-script.js --script-path admin/main.js \
	  --script-uri admin --assets-dir admin --dry-run

upload-all: upload-admin upload-editor upload-docs

# Publish admin, editor and docs on the management host (run after deploying).
set-script-hosts:
	@node scripts/set-script-hosts.js --script-uri admin \
	  --script-uri editor --script-uri docs \
	  --hosts $(MANAGE_HOSTNAME)

set-script-hosts-dry-run:
	@node scripts/set-script-hosts.js --script-uri admin \
	  --script-uri editor --script-uri docs \
	  --hosts $(MANAGE_HOSTNAME) --dry-run
