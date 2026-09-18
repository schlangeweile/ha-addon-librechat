# LibreChat Home Assistant add-on image
#
# Strategy: instead of building LibreChat from source (slow, fragile), we copy
# the finished app (production deps + built frontend) from the official
# multi-arch image into a Debian slim image, which gives us glibc for the
# official MongoDB apt repository. Everything here is native aarch64/amd64 -
# no emulation anywhere.
ARG LIBRECHAT_VERSION=v0.8.7

FROM ghcr.io/danny-avila/librechat:${LIBRECHAT_VERSION} AS librechat

FROM node:24.16.0-bookworm-slim

ARG TARGETARCH
ARG BUILD_ARCH
ARG LIBRECHAT_VERSION=v0.8.7
ARG MONGODB_VERSION=8.0
ARG MEILISEARCH_VERSION=v1.35.1
ARG S6_OVERLAY_VERSION=3.2.3.2
ARG BASHIO_VERSION=0.19.0

# mapfile below needs bash, the slim image defaults to dash
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# HOST must be 0.0.0.0 so the add-on port mapping reaches the app
# (the value in .env cannot override an exported env var)
ENV HOST=0.0.0.0

# --- System packages + MongoDB from the official apt repo (amd64 + arm64) ---
# Architecture resolution: BuildKit exports TARGETARCH (docker build), the
# home-assistant/builder exports BUILD_ARCH (HA naming) - normalize both.
# MongoDB publishes arm64 server packages for Ubuntu, not Debian: use the
# bookworm repo on amd64 and the jammy repo on arm64 (jammy binaries run fine
# on bookworm, glibc 2.35 <= 2.36)
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg xz-utils; \
    case "${TARGETARCH:-${BUILD_ARCH:-}}" in \
        amd64) MONGO_REPO="debian bookworm/mongodb-org/${MONGODB_VERSION} main" ;; \
        arm64|aarch64) MONGO_REPO="ubuntu jammy/mongodb-org/${MONGODB_VERSION} multiverse" ;; \
        *) echo "Unsupported architecture: ${TARGETARCH:-${BUILD_ARCH:-}}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://www.mongodb.org/static/pgp/server-${MONGODB_VERSION}.asc" \
        | gpg --dearmor -o "/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg"; \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] https://repo.mongodb.org/apt/${MONGO_REPO}" \
        > "/etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list"; \
    apt-get update; \
    apt-get install -y --no-install-recommends mongodb-org-server libjemalloc2; \
    echo "mongodb-org-server hold" | dpkg --set-selections; \
    # keep the upstream LD_PRELOAD path valid on Debian multiarch
    ln -s "$(find /usr/lib -name 'libjemalloc.so.2' | head -1)" /usr/lib/libjemalloc.so.2; \
    apt-get purge -y gnupg; \
    apt-get autoremove -y; \
    apt-get clean; rm -rf /var/lib/apt/lists/*

# keep the upstream LD_PRELOAD path valid on Debian multiarch (declared here,
# after libjemalloc2 exists, so build-time RUN shells do not warn)
ENV LD_PRELOAD=/usr/lib/libjemalloc.so.2

# --- s6-overlay v3 (supervisor) + bashio (HA helper library) ---
RUN set -eux; \
    case "${TARGETARCH:-${BUILD_ARCH:-}}" in \
        amd64) S6_ARCH=x86_64 ;; \
        arm64|aarch64) S6_ARCH=aarch64 ;; \
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
    ln -sf /usr/lib/bashio/bashio /usr/bin/bashio

# --- Meilisearch single binary (aarch64 + amd64 release assets) ---
RUN set -eux; \
    case "${TARGETARCH:-${BUILD_ARCH:-}}" in \
        amd64) MEILI_ARCH=amd64 ;; \
        arm64|aarch64) MEILI_ARCH=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH:-${BUILD_ARCH:-}}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/meilisearch/meilisearch/releases/download/${MEILISEARCH_VERSION}/meilisearch-linux-${MEILI_ARCH}" -o /opt/meilisearch; \
    chmod 755 /opt/meilisearch; \
    rm -rf /tmp/*

# --- LibreChat app from the official image ---
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
RUN find /etc/s6-overlay/s6-rc.d -type f \( -name run -o -name finish \) -exec chmod 755 {} +

EXPOSE 3080
ENTRYPOINT ["/init"]
