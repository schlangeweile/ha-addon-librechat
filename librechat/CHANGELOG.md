# Changelog

## 0.8.8-ha2

- **`useradm`: one-shot user administration via the config folder.** Home
  Assistant OS offers no shell access to add-on containers and LibreChat
  0.8.8 has no admin API to list/ban/delete accounts (the admin panel's
  user pages and the matching endpoints are unreleased upstream). To close
  this gap, a `useradm.json` placed in the add-on config folder is
  processed at add-on start before the app launches, then consumed and
  answered with `useradm.done.json`:
  - `{"list": true}` lists all users (username, email, role, ban state)
  - `{"ban": ["<name-or-email>"], "unban": [...]}` blocks/unblocks login
  - `{"delete": ["<name-or-email>"], "confirm": true}` removes accounts
    together with their data across ~24 collections, mirroring LibreChat's
    own account-deletion cleanup; without `confirm` it only reports what
    would be removed (dry run)
  - Users with the ADMIN role are never modified or deleted, and unknown
    identifiers produce warnings
- No LibreChat or admin panel version change (still v0.8.8 / panel 1.0.0)

## 0.8.8-ha1

- LibreChat **v0.8.8** final (was v0.8.8-rc4) - security hardening (MCP OAuth
  redirect/private-IP blocking, 2FA management rate limiting, one-time admin
  OAuth code redemption), background-task controls and model additions (Claude
  Sonnet 5.5, GPT-6.1 Sol); no breaking changes, DocumentDB/FerretDB paths
  untouched
- **Image namespace switch:** the upstream image moved to
  `ghcr.io/librechat-ai/librechat` after the repository transfer to the
  LibreChat-AI organization. The old `danny-avila` namespace is only mirrored
  upstream by a legacy copy job and stopped receiving tags after v0.8.8-rc4 -
  v0.8.8 final was never published there. Node 24.16.0, the `sharp` 0.35.4
  dependency and the Alpine `/app` image layout are unchanged for this add-on
- **Bundled admin panel** (`ghcr.io/clickhouse/librechat-admin-panel:1.0.0`)
  on new port **3081**: access management (custom roles and groups, assign
  existing users to them, per-role capability grants) and GUI editing of
  `librechat.yaml`. Log in with your LibreChat admin account (the first
  registered user). Note: the panel cannot create user accounts yet - users
  register through the chat UI as before (upstream roadmap item; the panel's
  user pages and the matching API endpoints are unreleased). The panel talks
  to the API container-internally; all browser traffic goes to port 3081
  only. Its session secret is generated once and persisted in `/data`. Set
  `ADMIN_PANEL_URL=http://<host>:3081` in `.env` to get a panel link in
  LibreChat's settings. The panel is optional: it may crash without affecting
  the chat
- The panel runtime (bun) is a musl binary and runs on the glibc base through
  a bundled musl loader under `/opt/admin-panel`; its arm64 build uses LSE
  atomics only behind a HWCAP runtime dispatch (outline atomics) and is
  therefore ARMv8.0-safe like every other bundled binary
- `.env.example` refreshed from the v0.8.8 tag: only the `OPENAI_MODELS`
  example list changed upstream (`gpt-6.1-sol` added); the local overrides
  (`CONFIG_PATH`, `SCHEDULES_SINGLE_PROCESS=true`) are kept

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
