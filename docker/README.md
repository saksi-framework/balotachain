# BalotaChain backend stack (Docker)

Containerized backend so the demo runs the same on any machine — no per-host Go,
Rust, or Fabric toolchain needed beyond Docker itself.

## What's here (Stage 1)

- **`bulletin-gateway`** — an HTTP service over the bulletin store
  (`crates/bulletin-gateway`, reusing `crates/bulletin-store`). It is the
  network-accessible stand-in for the Hyperledger Fabric bulletin board. State
  persists in the `balota-state` Docker volume.

Built/run via the repo-root [`docker-compose.yml`](../docker-compose.yml).

## Run it

```bash
docker compose up -d --build      # build image + start gateway on :8080
curl localhost:8080/healthz       # -> ok
docker compose down               # stop (volume + state are kept)
docker compose down -v            # stop and wipe state
```

## HTTP surface

| Method | Path        | Body         | Returns                              |
|--------|-------------|--------------|--------------------------------------|
| GET    | `/healthz`  | —            | `ok`                                 |
| GET    | `/bulletin` | —            | full `Bulletin` JSON (empty default) |
| PUT    | `/bulletin` | `Bulletin`   | the stored `Bulletin` (echo)         |

Schema: [`docs/bulletin-store-schema.md`](../docs/bulletin-store-schema.md).
Whole-document PUT matches the file store's "each app rewrites the whole file"
semantics, so client adapters swap `load`/`save` for `GET`/`PUT` unchanged.

## Config (env)

| Var             | Default              | Meaning                          |
|-----------------|----------------------|----------------------------------|
| `BULLETIN_PATH` | `/data/bulletin.json`| where state is persisted (volume)|
| `BULLETIN_ADDR` | `0.0.0.0:8080`       | listen address                   |

## Pointing clients at the gateway

Clients (the Rust `bulletin-store` consumers — `e2e-runner` and each Tauri app's
`src-tauri/src/balota.rs`) select their backend with one env var via
`BulletinSource::from_env()`:

```bash
export BALOTA_BULLETIN_URL=http://localhost:8080   # use the gateway
# unset -> falls back to the local ~/.balotachain/bulletin.json file
```

Wiring status: `BulletinSource` (File | Http) lives in `bulletin-store` and is
tested. Swapping each `balota.rs` and `e2e-runner` from the bare `load(path)` /
`save(path, b)` calls to `BulletinSource::from_env()` is the remaining client
step (see the repo `CLAUDE.md` "where we left off").

## Reproducible dev environment

`.devcontainer/devcontainer.json` provisions Rust + Go + Node/pnpm + Docker-in-Docker
so builds and tests are identical on any host. (Flutter SDK is not included by
default — add the community Flutter feature if you need to build the voter app in
the container; desktop GUI apps still run best natively.)

## Roadmap — Stage 2 (real Fabric)

Add a Fabric test-network + the saksi Go chaincode as services and have the
gateway route the **ballot slice** through `saksi-bulletin/client-sdk`. The REST
surface above does not change, so no client code changes. The rest of the schema
(election, voters, credentials, partial decryptions, tally) stays in the gateway
store since the chaincode only covers ballots.
