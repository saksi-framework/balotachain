//! HTTP gateway over the `bulletin-store` crate.
//!
//! Exposes the full bulletin (see `docs/bulletin-store-schema.md`) over a small
//! REST surface so the BalotaChain clients can share one backend on the network
//! instead of each reading a local `~/.balotachain/bulletin.json`. This is the
//! containerized stand-in for the Hyperledger Fabric bulletin board; the ballot
//! slice can later be backed by `saksi-bulletin/client-sdk` behind these same
//! routes without changing any client.
//!
//! Routes:
//!   GET  /healthz   -> "ok"
//!   GET  /bulletin  -> the full Bulletin as JSON (empty default if no state yet)
//!   PUT  /bulletin  -> replace the whole Bulletin (last-writer-wins, matching the
//!                      file store's "each app rewrites the entire file" semantics)
//!
//! Whole-document PUT mirrors the existing store contract exactly, so client
//! adapters swap `load(path)`/`save(path, b)` for `GET`/`PUT` with no behavior
//! change.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::get,
};
use bulletin_store::{Bulletin, load, save};

/// Shared handler state: where the bulletin lives on disk inside the container,
/// plus a mutex that serializes read-modify-write so concurrent clients can't
/// interleave a load/save pair (the file store assumes last-writer-wins, but we
/// still avoid torn reads of an in-flight write).
#[derive(Clone)]
pub struct AppState {
    pub path: PathBuf,
    pub lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            lock: Arc::new(Mutex::new(())),
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/bulletin", get(get_bulletin).put(put_bulletin))
        .with_state(state)
}

async fn healthz() -> &'static str {
    "ok"
}

async fn get_bulletin(State(s): State<AppState>) -> Result<Json<Bulletin>, ApiError> {
    let _guard = s.lock.lock().expect("bulletin lock poisoned");
    let bulletin = load(&s.path)?;
    Ok(Json(bulletin))
}

async fn put_bulletin(
    State(s): State<AppState>,
    Json(bulletin): Json<Bulletin>,
) -> Result<Json<Bulletin>, ApiError> {
    let _guard = s.lock.lock().expect("bulletin lock poisoned");
    save(&s.path, &bulletin)?;
    Ok(Json(bulletin))
}

/// Thin error wrapper so store failures become 500s with a readable body.
pub struct ApiError(String);

impl From<bulletin_store::StoreError> for ApiError {
    fn from(e: bulletin_store::StoreError) -> Self {
        ApiError(e.to_string())
    }
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::INTERNAL_SERVER_ERROR, self.0).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt; // for `oneshot`

    fn test_state() -> (tempfile::TempDir, AppState) {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, AppState::new(path))
    }

    #[tokio::test]
    async fn healthz_ok() {
        let (_dir, state) = test_state();
        let resp = router(state)
            .oneshot(Request::get("/healthz").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = resp.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(&body[..], b"ok");
    }

    #[tokio::test]
    async fn get_empty_returns_default_bulletin() {
        let (_dir, state) = test_state();
        let resp = router(state)
            .oneshot(Request::get("/bulletin").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = resp.into_body().collect().await.unwrap().to_bytes();
        let b: Bulletin = serde_json::from_slice(&body).unwrap();
        assert_eq!(b, Bulletin::empty());
    }

    #[tokio::test]
    async fn put_then_get_roundtrips() {
        let (_dir, state) = test_state();
        let mut b = Bulletin::empty();
        b.voters.push(bulletin_store::Voter {
            id: "v-000001".into(),
            email: "voter1@wmsu.edu.ph".into(),
            name: "Demo Voter".into(),
        });
        let body = serde_json::to_vec(&b).unwrap();

        let put = router(state.clone())
            .oneshot(
                Request::put("/bulletin")
                    .header("content-type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(put.status(), StatusCode::OK);

        let got = router(state)
            .oneshot(Request::get("/bulletin").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let bytes = got.into_body().collect().await.unwrap().to_bytes();
        let loaded: Bulletin = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(loaded, b);
    }
}
