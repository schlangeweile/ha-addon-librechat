# LibreChat

Open-source AI chat platform with a built-in database stack and Meilisearch
search engine. Runs fully local; bring your own model endpoints (OpenAI,
Anthropic, Google, local LLM servers via OpenAI-compatible APIs, and more).

## How it works

The add-on runs five services in one container:

| Service                          | Purpose                              | Bound to              |
| -------------------------------- | ------------------------------------ | --------------------- |
| LibreChat                        | Web UI + API on port 3080            | `0.0.0.0:3080`        |
| FerretDB                         | MongoDB-compatible API for LibreChat | `127.0.0.1:27017`     |
| PostgreSQL 17 + DocumentDB       | Document storage engine              | `127.0.0.1:5432`      |
| Meilisearch                      | Full-text search over conversations  | `127.0.0.1:7700`      |

Only port 3080 is exposed to your network; everything else is reachable
exclusively inside the add-on container. LibreChat connects to FerretDB with
the standard `MONGO_URI` (`mongodb://127.0.0.1:27017/LibreChat`); no
configuration needed for the database.

## Why FerretDB instead of MongoDB?

Official MongoDB arm64 binaries require ARMv8.2+ CPUs (LSE atomics). On
ARMv8.0 devices like the Odroid N2+ (Cortex-A73/A53) every MongoDB version
from 4.4 to 8.0 terminates immediately with SIGILL. FerretDB speaks the
MongoDB wire protocol on top of PostgreSQL with the DocumentDB extension -
all three components are ARMv8.0-safe and LibreChat officially supports this
backend since v0.8.8-rc3.

## Configuration

On first start, a default `.env` file is copied into the add-on configuration
folder (`/config` inside the container, shown as **LibreChat** under
`addon_configs` in Home Assistant). Edit it and restart the add-on to apply
changes. All LibreChat environment variables are documented upstream:

<https://www.librechat.ai/docs/configuration/librechat/env>

### librechat.yaml

Custom endpoint/model configuration (`librechat.yaml`) is supported: place the
file next to `.env` in the add-on config folder and add the following line to
`.env`:

```ini
CONFIG_PATH="/config/librechat.yaml"
```

`examples/reasoning-effort.yaml` in this repository shows a complete setup:
DeepSeek and GLM (Z.ai) custom endpoints with reasoning-effort model specs
(`reasoning_effort` low/high/max). Model specs must reference the custom
endpoint by its `name` exactly as defined, and `modelSpecs` entries live
under a `list:` key.

### Web search

Web search runs as an agentic tool: when enabled, the model itself decides
whether a query needs the web and calls LibreChat's `web_search` tool, which
the server executes through a configured search provider (serper, tavily,
searxng or keenable) - the provider results are returned to the model as tool
results. This works with custom OpenAI-compatible endpoints whose models
support function calling. The quickest setup is Tavily (free tier available);
add the following to `.env`, restart, then toggle **Web Search** in the chat
input's tools menu (per conversation):

```ini
LIBRECHAT_WEB_SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
```

The same can be configured in `librechat.yaml` via the `webSearch:` section
(see `examples/reasoning-effort.yaml`, which also enables `webSearch: true`
on the DeepSeek model specs so they start with search available).

### Secrets

Generate the secrets referenced in `.env` (e.g. `CREDS_KEY`, `CREDS_IV`,
`JWT_SECRET`) with the upstream toolkit:

<https://www.librechat.ai/toolkit>

If you leave them blank, LibreChat generates temporary secrets on each start,
which logs you out after every restart and breaks saved API-key credentials.
Set them once and keep them stable.

### Search

The default `.env` ships with `SEARCH=false`. To enable Meilisearch full-text
search, set `SEARCH=true` and a strong `MEILI_MASTER_KEY` in `.env`, then
restart. The key shipped in the default `.env` is a public example value -
replace it.

## Data & backup

All persistent data lives in the add-on's `/data` volume (PostgreSQL cluster
in `postgresql/`, Meilisearch index in `meilisearch/`, uploaded images in
`images/`) and the add-on config folder (`.env`, `librechat.yaml`). A normal
Home Assistant add-on backup captures both. Restoring into a fresh install
restores your accounts and chats.

## Updating

Updates are delivered by bumping the add-on version in this repository;
prebuilt images are published by GitHub Actions and pulled by the supervisor.
After an update, the add-on automatically resets an incompatible Meilisearch
database; PostgreSQL data is migrated by PostgreSQL itself.

## Add-on log

The add-on log shows the interleaved output of all services. If PostgreSQL or
FerretDB crash, the last PostgreSQL log lines are printed before the add-on
halts.
