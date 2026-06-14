# Multi-stage build for the BalotaChain bulletin gateway.
# Build context is the repo root (see docker-compose.yml) so the gateway crate's
# `../bulletin-store` path dependency resolves.

FROM rust:slim AS builder
WORKDIR /app
# Only the two crates the gateway needs — keeps the layer small and cache-stable.
COPY crates/bulletin-store crates/bulletin-store
COPY crates/bulletin-gateway crates/bulletin-gateway
WORKDIR /app/crates/bulletin-gateway
RUN cargo build --release --bin bulletin-gateway

FROM debian:bookworm-slim
# Run as an unprivileged user; /data is the state volume.
RUN useradd --system --uid 10001 balota \
    && mkdir -p /data \
    && chown balota /data
COPY --from=builder /app/crates/bulletin-gateway/target/release/bulletin-gateway \
     /usr/local/bin/bulletin-gateway
USER balota
VOLUME ["/data"]
EXPOSE 8080
ENV BULLETIN_PATH=/data/bulletin.json \
    BULLETIN_ADDR=0.0.0.0:8080
ENTRYPOINT ["/usr/local/bin/bulletin-gateway"]
