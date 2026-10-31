# LibreChat for Home Assistant (arm64 & amd64)

A Home Assistant add-on running [LibreChat](https://www.librechat.ai) -
the open-source AI chat platform - with a built-in FerretDB/PostgreSQL
document database, Meilisearch full-text search, a standalone admin panel
and an optional text-to-speech gateway. Everything runs locally in a single
container; you supply the model endpoints (OpenAI, Anthropic, any
OpenAI-compatible server such as DashScope or Ollama, ...).

It targets devices like the **Hardkernel Odroid N2+** and Raspberry Pi 4/5
(aarch64) as well as x86-64 machines. The add-on image is assembled from
official multi-arch release artifacts (no compilation from source): the
LibreChat app image, PostgreSQL 17 with the DocumentDB extension, FerretDB,
Meilisearch and the admin panel, supervised by s6-overlay. Ready-made images
for both architectures are built by GitHub Actions and pulled on install.

> **Status:** verified. All bundled binaries were checked for ARMv8.0
> compatibility (no LSE atomics): FerretDB, PostgreSQL 17 with the
> DocumentDB extension, Meilisearch and the admin panel runtime (bun) were
> verified statically and, where applicable, under QEMU cortex-a53; the
> DashScope SDK is pure Python. The add-on was tested on a real Odroid N2+
> with 0.8.7; final on-device confirmation for the 0.8.8 stack is still
> pending - see the add-on changelog for details. The add-on layer is at
> **0.8.8-ha5** (cold backups, Open Web UI button, corrected account
> deletion in `useradm`, documentation and CI fixes); the bundled LibreChat
> image is **v0.8.8**, the admin panel **1.0.0**.

| Architecture | Status |
| ------------ | ------ |
| aarch64 (ARMv8.0) | 0.8.7 tested on Odroid N2+; 0.8.8 stack statically + emulated verified, on-device test pending |
| amd64        | built from the same multi-arch sources |

## Requirements

- Home Assistant OS or Supervised, aarch64 or amd64.
- ~6 GB of free disk for the image, plus room for the PostgreSQL cluster,
  the Meilisearch index and uploaded images under `/data`.
- At least 2 GB RAM; 4 GB is comfortable for several users and chats.
  A Raspberry Pi 3 (1 GB) is instruction-set compatible but too small.

## Features

- **The full LibreChat feature set:** custom OpenAI-compatible endpoints,
  agents and MCP servers, file and image uploads, presets, scheduled chats,
  web search through Tavily, Serper, SearXNG or Keenable, and multi-user
  accounts.
- **Admin panel on port 3081:** custom roles and groups, per-role capability
  grants and GUI editing of `librechat.yaml`. Accounts are created through
  chat registration (the panel cannot create them yet); `useradm.json`
  lists, bans and deletes accounts from the add-on config folder.
- **Meilisearch full-text search** over conversations (optional: set
  `SEARCH=true` and a `MEILI_MASTER_KEY` in `.env`).
- **Optional text-to-speech** through a bundled gateway on
  `127.0.0.1:3082` (OpenAI-compatible `/v1/audio/speech`, voices from
  Alibaba Model Studio / DashScope, selectable per user in the chat).
- **FerretDB + PostgreSQL 17 + DocumentDB** storage instead of MongoDB:
  every official MongoDB arm64 build requires ARMv8.2+ and fails with SIGILL
  on ARMv8.0, while this stack is ARMv8.0-safe and officially supported by
  LibreChat since v0.8.8-rc3.
- **Everything stays local** except the model endpoints you configure (and
  the TTS service, if you enable it).

### Admin panel and user administration

The panel at `http://<home-assistant>:3081` logs in with the LibreChat admin
account (the first registered user). It manages access (roles, groups,
capability grants) and edits `librechat.yaml` through a form UI; most
settings apply without restarting the chat. Because LibreChat 0.8.8 has no
admin API for account CRUD, listing, banning and deleting users is done with
the one-shot `useradm.json` file in the add-on config folder (see the
documentation).

### Search and text-to-speech

Search is off by default in the shipped `.env`; enable it with `SEARCH=true`
and a strong `MEILI_MASTER_KEY`. The TTS gateway is optional and independent:
set `DASHSCOPE_API_KEY` and `TTS_WS_URL` in `.env` and add the documented
`speech:` block to `librechat.yaml`; without them the chat works unchanged.

## How it works

Seven s6 services run in one container:

| Service                    | Purpose                                       | Bound to          |
| -------------------------- | --------------------------------------------- | ----------------- |
| PostgreSQL 17 + DocumentDB | Document storage engine                       | `127.0.0.1:5432`  |
| `dbinit` (one-shot)        | Creates the database and DocumentDB extension | –                 |
| FerretDB                   | MongoDB-compatible API for LibreChat          | `127.0.0.1:27017` |
| LibreChat                  | Web UI and API on port 3080                   | `0.0.0.0:3080`    |
| Admin panel                | User/role management, configuration           | `0.0.0.0:3081`    |
| Meilisearch                | Full-text search over conversations           | `127.0.0.1:7700`  |
| TTS gateway                | OpenAI-compatible speech endpoint             | `127.0.0.1:3082`  |

Ports 3080 (chat) and 3081 (admin panel) are exposed to your network;
everything else is reachable only inside the add-on container. A PostgreSQL
or FerretDB crash halts the add-on with a log dump and a 60 s grace period;
a Meilisearch, admin panel or TTS crash only restarts that service.

## Configuration

Configuration is file-based: on first start a `.env` file and a minimal
`librechat.yaml` appear in the add-on configuration folder (shown as
**LibreChat** under `addon_configs`). Edit them and restart the add-on.
Secrets such as `CREDS_KEY`, `CREDS_IV` and `JWT_SECRET` should be set once
and kept stable; custom endpoints, web search, Meilisearch and TTS are
documented in the add-on's **Documentation** tab. Set `ADMIN_PANEL_URL` to
get an "Admin Panel" link in the chat's settings.

## Installation

[![Open your Home Assistant instance and show the add-on repository dialog.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fschlangeweile%2Fha-addon-librechat)

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮ menu → Repositories**, add
   `https://github.com/schlangeweile/ha-addon-librechat`.
3. Refresh, open **LibreChat** from the store and click **Install**
   (the finished image is pulled for your device's architecture).
4. Start the add-on and click **Open Web UI** (or open
   `http://<home-assistant>:3080`). The first account you register becomes
   the administrator. The bundled admin panel at
   `http://<home-assistant>:3081` manages roles, groups, permissions and
   configuration.

## Backups and updates

- A Home Assistant add-on backup includes the `/data` volume (PostgreSQL
  cluster, Meilisearch index, uploaded images) and the add-on config folder
  (`.env`, `librechat.yaml`, `useradm.json`), so accounts and chats are
  captured.
- Backups run in cold mode: the add-on is stopped briefly while `/data` is
  copied, keeping the live PostgreSQL cluster and Meilisearch LMDB
  consistent (the Supervisor defaults to hot backups).
- Add-on updates simply pin a newer LibreChat version; PostgreSQL applies
  its migrations on start, and an incompatible Meilisearch database is reset
  automatically after an engine bump.

## Updating to a newer LibreChat

The add-on version tracks the bundled LibreChat version. To move to a newer
release, bump the `LIBRECHAT_VERSION` default in `librechat/Dockerfile` and
the add-on `version` in `librechat/config.yaml` - GitHub Actions builds the
new images and the supervisor offers the add-on update in the store. The
workflow fails before building if the two versions drift apart. Refresh
`librechat/rootfs/etc/librechat/.env.example` from the matching upstream tag
and re-check the `librechat.yaml` config version, the sharp replacement and
the admin panel after a bump; details are in the add-on changelog.

### Migrating from another LibreChat add-on

This add-on stores its data in FerretDB/PostgreSQL since 0.8.8-rc3. MongoDB
`db/` files from older installations are not read, and there is no in-add-on
conversion path (no `mongodump`/`mongorestore`, FerretDB on loopback only):

1. Back up the old add-on, uninstall it, then install this one.
2. Copy `.env` from the backup's `addon_config/librechat/` into the new
   configuration folder; API keys and endpoint settings carry over.
3. Copy `data/images/` into `/data/images/`; the Meilisearch index may be
   copied too, but is rebuilt if the engine version differs.
4. Accounts and chats from `db/` cannot be migrated this way. Keep the old
   backup until you no longer need the history, or start fresh.

## Why this exists

Compared to the sibling
[AnythingLLM add-on](https://github.com/schlangeweile/ha-addon-anythingllm),
which runs a single container with embedded SQLite/LanceDB and a built-in
admin dashboard, LibreChat offers the broader LibreChat platform (agents,
MCP servers, presets, scheduled chats, admin panel, optional TTS) but needs
the FerretDB/PostgreSQL and Meilisearch services and more disk and RAM. Use
AnythingLLM for a lean RAG-focused chat; use LibreChat when you want its
full feature set and model configuration.

## Credits

- [LibreChat](https://github.com/danny-avila/LibreChat) by Danny Avila and
  contributors (MIT)

Licensed under Apache 2.0 - see [LICENSE](LICENSE).
