# LibreChat Home Assistant add-on image
#
# The database stack is FerretDB (MongoDB wire-protocol API) on PostgreSQL 17
# with the DocumentDB extension. This is deliberate: official MongoDB arm64
# binaries are compiled for ARMv8.2+ (LSE atomics) and terminate with SIGILL
# on ARMv8.0 hardware such as the Odroid N2+. PostgreSQL, the DocumentDB
# extension and FerretDB are all ARMv8.0-safe (verified with QEMU cortex-a53
# and an LSE opcode scan). LibreChat gained official DocumentDB/FerretDB
# support in v0.8.8-rc3.
ARG LIBRECHAT_VERSION=v0.8.8-rc3

FROM ghcr.io/danny-avila/librechat:${LIBRECHAT_VERSION} AS librechat

FROM ghcr.io/ferretdb/ferretdb:2.7.0 AS ferretdb

FROM node:24.16.0-bookworm-slim AS node

FROM ghcr.io/ferretdb/postgres-documentdb:17-0.107.0-ferretdb-2.7.0

ARG TARGETARCH
ARG BUILD_ARCH
ARG LIBRECHAT_VERSION=v0.8.8-rc3
ARG MEILISEARCH_VERSION=v1.35.1
ARG S6_OVERLAY_VERSION=3.2.3.2
ARG BASHIO_VERSION=0.19.0

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# HOST must be 0.0.0.0 so the add-on port mapping reaches the app
# (the value in .env cannot override an exported env var).
# FerretDB listens on 127.0.0.1:27017 without client authentication
# (loopback only, container-local); PostgreSQL auth is trust on loopback.
ENV HOST=0.0.0.0 \
    PGDATA=/data/postgresql \
    FERRETDB_POSTGRESQL_URL=postgres://ferretdb@127.0.0.1:5432/ferretdb \
    FERRETDB_AUTH=false \
    FERRETDB_TELEMETRY=disable \
    FERRETDB_LISTEN_ADDR=127.0.0.1:27017

# --- s6-overlay v3 (supervisor) + bashio (HA helper library) + Meilisearch ---
# Architecture resolution: BuildKit exports TARGETARCH (docker build), the
# home-assistant/builder exports BUILD_ARCH (HA naming) - normalize both.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl xz-utils; \
    case "${TARGETARCH:-${BUILD_ARCH:-}}" in \
        amd64) S6_ARCH=x86_64; MEILI_ARCH=amd64 ;; \
        arm64|aarch64) S6_ARCH=aarch64; MEILI_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH:-${BUILD_ARCH:-}}" >&2; exit 1 ;; \
    esac; \
    S6_BASE="https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}"; \
    curl -fsSL "${S6_BASE}/s6-overlay-noarch.tar.xz" -o /tmp/s6-noarch.tar.xz; \
    curl -fsSL "${S6_BASE}/s6-overlay-${S6_ARCH}.tar.xz" -o /tmp/s6-arch.tar.xz; \
    curl -fsSL "${S6_BASE}/s6-overlay-symlinks-noarch.tar.xz" -o /tmp/s6-symlinks.tar.xz; \
    tar -C / -Jxpf /tmp/s6-noarch.tar.xz; \
    tar -C / -Jxpf /tmp/s6-arch.tar.xz; \
    tar -C / -Jxpf /tmp/s6-symlinks.tar.xz; \
    curl -fsSL "https://github.com/hassio-addons/bashio/archive/refs/tags/v${BASHIO_VERSION}.tar.gz" -o /tmp/bashio.tar.gz; \
    mkdir -p /tmp/bashio /usr/lib/bashio; \
    tar -xzf /tmp/bashio.tar.gz --strip-components=1 -C /tmp/bashio; \
    mv /tmp/bashio/lib/* /usr/lib/bashio/; \
    ln -sf /usr/lib/bashio/bashio /usr/bin/bashio; \
    curl -fsSL "https://github.com/meilisearch/meilisearch/releases/download/${MEILISEARCH_VERSION}/meilisearch-linux-${MEILI_ARCH}" -o /opt/meilisearch; \
    chmod 755 /opt/meilisearch; \
    rm -rf /tmp/* /var/lib/apt/lists/*

# Node.js + npm from the official node image (postgres base has none);
# /usr/local already contains the postgres image's gosu - extend, not replace
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# FerretDB server binary (Go, GOARM64=v8.0 - safe on ARMv8.0)
COPY --from=ferretdb /ferretdb /usr/local/bin/ferretdb

# LibreChat app from the official image (built frontend + production deps)
COPY --from=librechat /app /app
WORKDIR /app

# The official image is Alpine (musl): replace the sharp prebuilds with the
# glibc variants so image uploads keep working on this Debian base
RUN set -eux; \
    SHARP_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/sharp']?.version || require('./api/package.json').dependencies.sharp")"; \
    rm -rf node_modules/@img node_modules/sharp; \
    npm install --no-save --no-audit --no-fund --omit=dev "sharp@${SHARP_VERSION}"; \
    rm -rf /root/.npm

COPY rootfs /
RUN find /etc/s6-overlay -type f \( -name run -o -name finish -o -name up -o -path "*/scripts/*" \) -exec chmod 755 {} +

EXPOSE 3080
ENTRYPOINT ["/init"]
