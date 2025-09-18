use crate::infrastructure::config::Config;
use axum::extract::Request;
use axum::http::{header, HeaderValue};
use axum::middleware::Next;
use axum::response::Response;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

/// Security headers middleware to protect against common web vulnerabilities
/// 🔒 SECURITY: Now uses configurable headers instead of hardcoded values
pub fn create_security_headers_middleware(
    config: Arc<Config>,
) -> impl Fn(Request, Next) -> Pin<Box<dyn Future<Output = Response> + Send>> + Clone {
    move |request: Request, next: Next| {
        let config = config.clone();
        Box::pin(async move {
            let mut response = next.run(request).await;

            let headers = response.headers_mut();

            // Content Security Policy - configurable to allow environment-specific policies
            headers.insert(
                header::HeaderName::from_static("content-security-policy"),
                HeaderValue::from_str(&config.csp_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("default-src 'self'") // Safe fallback
                }),
            );

            // X-Content-Type-Options - prevent MIME type sniffing
            headers.insert(
                header::HeaderName::from_static("x-content-type-options"),
                HeaderValue::from_static("nosniff"),
            );

            // X-Frame-Options - configurable clickjacking protection
            headers.insert(
                header::HeaderName::from_static("x-frame-options"),
                HeaderValue::from_str(&config.x_frame_options).unwrap_or_else(|_| {
                    HeaderValue::from_static("DENY") // Safe fallback
                }),
            );

            // X-XSS-Protection - enable XSS filtering (legacy browsers)
            headers.insert(
                header::HeaderName::from_static("x-xss-protection"),
                HeaderValue::from_static("1; mode=block"),
            );

            // Strict-Transport-Security - configurable HTTPS enforcement
            let hsts_value = if config.hsts_include_subdomains {
                format!(
                    "max-age={}; includeSubDomains; preload",
                    config.hsts_max_age
                )
            } else {
                format!("max-age={}", config.hsts_max_age)
            };
            headers.insert(
                header::HeaderName::from_static("strict-transport-security"),
                HeaderValue::from_str(&hsts_value).unwrap_or_else(|_| {
                    HeaderValue::from_static("max-age=31536000; includeSubDomains; preload")
                    // Safe fallback
                }),
            );

            // Referrer-Policy - configurable referrer information control
            headers.insert(
                header::HeaderName::from_static("referrer-policy"),
                HeaderValue::from_str(&config.referrer_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("strict-origin-when-cross-origin") // Safe fallback
                }),
            );

            // Permissions-Policy - configurable browser features control
            headers.insert(
                header::HeaderName::from_static("permissions-policy"),
                HeaderValue::from_str(&config.permissions_policy).unwrap_or_else(|_| {
                    HeaderValue::from_static("geolocation=(), microphone=(), camera=()")
                    // Safe fallback
                }),
            );

            response
        })
    }
}
