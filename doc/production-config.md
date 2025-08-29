Production Configuration Notes

- COOKIE_DOMAIN: Set to a shared domain (e.g., `.fassandra.de`) so auth and CSRF cookies are valid on both apex and subdomains. This prevents intermittent auth issues across `fassandra.de` vs `www.fassandra.de`.
  - In `.env.prod` add: `COOKIE_DOMAIN=.fassandra.de`
  - Works in production mode only. Dev is unchanged.

- SameSite/Secure: In production, cookies use `SameSite=Lax` and `Secure=true` automatically; ensure HTTPS termination is active.

- CORS: `ALLOWED_ORIGINS` must include the exact origins you serve (both `https://fassandra.de` and `https://www.fassandra.de` if both are used).

- Canonical host: Prefer redirecting one host to the other at the proxy to avoid split sessions and service worker scope conflicts.

