use std::sync::OnceLock;
use std::time::Instant;

use anyhow::Result;
use axum::extract::{MatchedPath, Request};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};

static PROMETHEUS_HANDLE: OnceLock<PrometheusHandle> = OnceLock::new();

/// Initialize the global metrics recorder.
///
/// This should be called once during application startup before any metrics macros
/// are used. Subsequent calls are no-ops.
pub fn init_metrics() -> Result<()> {
    if PROMETHEUS_HANDLE.get().is_some() {
        return Ok(());
    }

    let handle = PrometheusBuilder::new()
        .install_recorder()
        .map_err(|err| anyhow::anyhow!("failed to install Prometheus recorder: {}", err))?;

    PROMETHEUS_HANDLE
        .set(handle)
        .map_err(|_| anyhow::anyhow!("Prometheus recorder already initialized"))?;

    Ok(())
}

/// HTTP handler that exposes collected Prometheus metrics.
pub async fn metrics_endpoint() -> Response {
    if let Some(handle) = PROMETHEUS_HANDLE.get() {
        let body = handle.render();
        (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                "text/plain; version=0.0.4; charset=utf-8",
            )],
            body,
        )
            .into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "metrics recorder not initialized",
        )
            .into_response()
    }
}

/// Middleware that records request counts and latency histograms for every HTTP call.
pub async fn track_http_metrics(req: Request, next: Next) -> Response {
    let method_label = req.method().as_str().to_owned();
    let path_label = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| req.uri().path().to_owned());

    let start = Instant::now();
    let response = next.run(req).await;
    let latency = start.elapsed().as_secs_f64();
    let status = response.status();
    let status_label = status.as_u16().to_string();

    metrics::counter!(
        "http_requests_total",
        "method" => method_label.clone(),
        "path" => path_label.clone(),
        "status" => status_label.clone(),
    )
    .increment(1);

    metrics::histogram!(
        "http_request_duration_seconds",
        "method" => method_label,
        "path" => path_label,
        "status" => status_label,
    )
    .record(latency);

    response
}
