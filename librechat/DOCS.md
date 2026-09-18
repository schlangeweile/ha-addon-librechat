# LibreChat

Open-source AI chat platform with a built-in MongoDB database and Meilisearch
search engine. Runs fully local; bring your own model endpoints (OpenAI,
Anthropic, Google, local LLM servers via OpenAI-compatible APIs, and more).

## How it works

The add-on runs three services in one container:

| Service     | Purpose                              | Bound to              |
| ----------- | ------------------------------------ | --------------------- |
| LibreChat   | Web UI + API on port 3080            | `0.0.0.0:3080`        |
| MongoDB 8.0 | Chat history / user database         | `127.0.0.1:27017`     |
| Meilisearch | Full-text search over conversations  | `127.0.0.1:7700`      |

Only port 3080 is exposed to your network; the database and search engine are
reachable exclusively inside the add-on container.

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

### Secrets

Generate the secrets referenced in `.env` (e.g. `CREDS_KEY`, `CREDS_IV`,
`JWT_SECRET`) with the upstream toolkit:

<https://www.librechat.ai/toolkit>

If you leave them blank, LibreChat generates temporary secrets on each start,
which logs you out after every restart and breaks saved API-key credentials.
Set them once and keep them stable.

### Search

Set `SEARCH=true` and a strong `MEILI_MASTER_KEY` in `.env` to enable
Meilisearch full-text search. The key shipped in the default `.env` is a
public example value - replace it.

## Data & backup

All persistent data lives in the add-on's `/data` volume (MongoDB database,
Meilisearch index, uploaded images) and the add-on config folder (`.env`,
`librechat.yaml`). A normal Home Assistant add-on backup captures both.
Restoring into a fresh install restores your accounts and chats.

## Updating

Updates are delivered by bumping the add-on version in this repository. The
supervisor rebuilds the image locally on your device (a few minutes, no
compilation of LibreChat itself). After an update, the add-on automatically
resets an incompatible Meilisearch database; MongoDB data is migrated by
MongoDB itself.

## Add-on log

The add-on log shows the interleaved output of all three services. If MongoDB
crashes, the last 20 lines of its log are printed before the add-on halts.
