# Changelog

## 0.8.7-ha1

- Initial release of this repository:
  - LibreChat **v0.8.7** - app taken from the official multi-arch image
    instead of building from source
  - **aarch64/arm64 fully supported**; verified against Hardkernel Odroid N2+
  - MongoDB 8.0 from the official Debian apt repository (arm64 + amd64)
  - Meilisearch v1.35.1 (was 1.12.3)
  - s6-overlay v3 native service supervision, same service scripts and
    behavior as the original add-on (including the automatic Meilisearch
    database reset after version upgrades)
  - `sharp` native module replaced with glibc builds so image uploads work on
    the new Debian base
  - Meilisearch now binds to 127.0.0.1 only (was 0.0.0.0)
