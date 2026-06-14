//! Binary entrypoint for the BalotaChain bulletin gateway.
//!
//! Configuration (env):
//!   BULLETIN_PATH  where the bulletin JSON is persisted. Default `/data/bulletin.json`
//!                  (mount a volume there in Docker so state survives restarts).
//!   BULLETIN_ADDR  listen address. Default `0.0.0.0:8080`.

use bulletin_gateway::{AppState, router};

#[tokio::main]
async fn main() {
    let path = std::env::var("BULLETIN_PATH").unwrap_or_else(|_| "/data/bulletin.json".to_string());
    let addr = std::env::var("BULLETIN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());

    let state = AppState::new(&path);
    let app = router(state);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));

    println!("bulletin-gateway listening on http://{addr} (store: {path})");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    println!("bulletin-gateway shutting down");
}
