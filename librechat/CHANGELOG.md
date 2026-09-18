# Changelog

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
