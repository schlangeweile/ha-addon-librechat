# LibreChat for Home Assistant (arm64 & amd64)

A Home Assistant add-on repository running [LibreChat](https://www.librechat.ai)
- the open-source AI chat platform - with a built-in FerretDB/PostgreSQL
document database and Meilisearch full-text search. Everything runs locally
on your Home Assistant OS device; you supply the model endpoints (OpenAI,
Anthropic, local LLM servers, ...).

It targets devices like the **Hardkernel Odroid N2+** and Raspberry Pi 4/5
(aarch64) as well as x86-64 machines. All bundled services are verified to
run on ARMv8.0 CPUs (official MongoDB arm64 builds are not - hence the
FerretDB/DocumentDB storage engine, which LibreChat officially supports).

| Architecture | Status |
| ------------ | ------ |
| aarch64 (ARMv8.0) | tested for Odroid N2+ |
| amd64        | built from the same multi-arch sources |

The add-on image is assembled from official multi-arch release artifacts (no
compilation from source): the LibreChat app image, PostgreSQL 17 with the
DocumentDB extension, FerretDB and Meilisearch, supervised by s6-overlay.
Ready-made images for both architectures are built by GitHub Actions and
pulled on install.

## Installation

[![Open your Home Assistant instance and show the add-on repository dialog.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository=https%3A%2F%2Fgithub.com%2Fschlangeweile%2Fha-addon-librechat)

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮ menu → Repositories**, add
   `https://github.com/schlangeweile/ha-addon-librechat`.
3. Refresh, open **LibreChat** from the store and click **Install**
   (the finished image is pulled for your device's architecture).
4. Start the add-on and open `http://<home-assistant>:3080`.
   The first account you register becomes the administrator.

Configuration is file-based: on first start a `.env` file appears in the
add-on configuration folder. See the add-on's **Documentation** tab for
details (secrets, `librechat.yaml`, search, backups).

## Migrating from another LibreChat add-on installation

1. Create a Home Assistant backup of the old add-on (contains MongoDB data,
   Meilisearch data and your `.env`).
2. Uninstall the old add-on, then install this one.
3. Copy your `.env` from the backup's `addon_config/librechat/` folder into
   the new add-on's configuration folder (or edit the fresh one).
4. If you also want your chats, restore the backup's `data` folder contents
   (`db/`, `meilisearch/`, `images/`) into the new add-on's `/data` volume,
   e.g. via the `Terminal & SSH` add-on under `/addon_configs`/`/data` paths
   shown in the documentation tab.

## Updating to a newer LibreChat

The add-on version tracks the bundled LibreChat version. To move to a newer
LibreChat release, bump the `LIBRECHAT_VERSION` default in
`librechat/Dockerfile` and the add-on `version` in `librechat/config.yaml` -
GitHub Actions builds the new images and the supervisor offers the add-on
update in the store.

## Credits

- [LibreChat](https://github.com/danny-avila/LibreChat) by Danny Avila and
  contributors (MIT)

Licensed under Apache 2.0 - see [LICENSE](LICENSE).
