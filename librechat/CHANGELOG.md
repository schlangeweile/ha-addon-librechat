# Changelog

## 0.8.8-rc4-ha1

- LibreChat **v0.8.8-rc4** (was v0.8.8-rc3) - upstream pre-release with ~100
  fixes and additions (new OpenAI/Anthropic/xAI models, agent tooling and
  trace-viewer improvements, streaming performance work); no breaking changes
  announced, database stack untouched
- Verified unchanged for this add-on: Node 24.16.0 (`.nvmrc` identical to the
  base image), `sharp` still a dependency (glibc replacement step stays),
  official image still Alpine with the `/app` layout, and the
  DocumentDB/FerretDB compatibility code paths are still present in the tag
- Refreshed `.env.example` from the v0.8.8-rc4 tag (new RUM proxy auth
  options, updated `OPENAI_MODELS` list incl. GPT-6 Sol/Luna, reworked
  schedules comments); the local override
  `CONFIG_PATH="/config/librechat.yaml"` is kept
- `SCHEDULES_SINGLE_PROCESS=true` stays active in the default `.env`
  (upstream rc4 comments it out): without it and without Redis, rc4 refuses
  to arm the scheduler and all schedule write routes return 503 - this
  add-on is exactly one LibreChat process, the case the flag asserts.
  Existing installs seeded from 0.8.8-rc3 already have the flag set
- `librechat.yaml` stub now writes config version `1.3.17` (documented for
  v0.8.8-rc4; upstream example file renamed to `librechat.example.yaml`)

## 0.8.8-rc3-ha2

- The auto-created `librechat.yaml` stub now uses config version `1.3.16`,
  matching the version documented for the bundled LibreChat v0.8.8-rc3 (the
  previous stub wrote `1.0.0`; cosmetic only, since the version is not
  validated against a fixed value)
- Added `examples/reasoning-effort.yaml`: reference `librechat.yaml` with
  DeepSeek and GLM (Z.ai) custom endpoints and reasoning-effort model specs
  (repo documentation only; not shipped in the image)
- DeepSeek example and DOCS.md now cover web search: LibreChat's agentic
  `web_search` tool with Tavily as provider (`webSearch:` section plus
  `webSearch: true` on the model specs), since DeepSeek's API has no native
  search

## 0.8.8-rc3-ha1

- **Storage engine switched from MongoDB to FerretDB + PostgreSQL 17 with the
  DocumentDB extension.** Official MongoDB arm64 binaries require ARMv8.2+
  CPUs (LSE atomics) and terminate with SIGILL on ARMv8.0 hardware such as the
  Odroid N2+ (Cortex-A73/A53), which made the previous release unable to start
  its database. PostgreSQL, the DocumentDB extension and FerretDB are verified
  ARMv8.0-safe, and LibreChat officially supports DocumentDB/FerretDB from
  v0.8.8-rc3.
- LibreChat **v0.8.8-rc3** (was 0.8.7) - required for the FerretDB/DocumentDB
  code paths (includes fixes for pipeline-form update queries that broke
  logins on DocumentDB engines)
- Meilisearch v1.35.1 (unchanged); note the new default `.env` ships with
  `SEARCH=false` - enable search in your `.env` if you used it before
- Data directory layout change: `/data/postgresql` (WiredTiger `/data/db` from
  the previous release is no longer used; the previous release never started
  successfully, so no migration is needed)

## 0.8.7-ha1

- Initial release of this repository:
  - LibreChat **v0.8.7** - app taken from the official multi-arch image
    instead of building from source
  - **aarch64/arm64 fully supported**; verified against Hardkernel Odroid N2+
  - MongoDB 8.0 from the official apt repository (arm64 + amd64)
  - Meilisearch v1.35.1 (was 1.12.3)
  - s6-overlay v3 native service supervision, same service scripts and
    behavior as the original add-on (including the automatic Meilisearch
    database reset after version upgrades)
  - `sharp` native module replaced with glibc builds so image uploads work on
    the new Debian base
  - Meilisearch now binds to 127.0.0.1 only (was 0.0.0.0)

  Note: the bundled MongoDB server turned out to be incompatible with
  ARMv8.0 CPUs (see 0.8.8-rc3-ha1).
