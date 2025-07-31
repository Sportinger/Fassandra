-- Example Queries for Improved API Endpoint Schema
-- Shows why separate tables are much better for querying

-- 1. Find all authenticated POST endpoints
SELECT c.name, e.path, e.description
FROM api_endpoints e
JOIN components c ON e.component_id = c.id
WHERE e.method = 'POST' AND e.is_authenticated = TRUE;

-- 2. Find all endpoints that accept a 'script_id' parameter
SELECT DISTINCT c.name, e.method, e.path
FROM api_parameters p
JOIN api_endpoints e ON p.endpoint_id = e.id
JOIN components c ON e.component_id = c.id
WHERE p.name = 'script_id';

-- 3. Get all endpoints for a specific component with parameter count
SELECT 
    e.method,
    e.path,
    e.description,
    COUNT(p.id) as param_count
FROM api_endpoints e
LEFT JOIN api_parameters p ON e.id = p.endpoint_id
WHERE e.component_id = (SELECT id FROM components WHERE name = 'backend-service')
GROUP BY e.id
ORDER BY e.path;

-- 4. Find all endpoints with rate limiting
SELECT c.name, e.method, e.path, e.rate_limit
FROM api_endpoints e
JOIN components c ON e.component_id = c.id
WHERE e.rate_limit IS NOT NULL;

-- 5. Analyze API complexity by component
SELECT 
    c.name,
    c.type,
    COUNT(DISTINCT e.id) as endpoint_count,
    COUNT(DISTINCT e.method) as method_types,
    COUNT(DISTINCT p.id) as total_parameters,
    AVG(CASE WHEN p.required THEN 1 ELSE 0 END) as avg_required_params_ratio
FROM components c
LEFT JOIN api_endpoints e ON c.id = e.component_id
LEFT JOIN api_parameters p ON e.id = p.endpoint_id
WHERE c.type IN ('service', 'webapp')
GROUP BY c.id
ORDER BY endpoint_count DESC;

-- 6. Find endpoints by path pattern (e.g., all script-related endpoints)
SELECT c.name, e.method, e.path, e.description
FROM api_endpoints e
JOIN components c ON e.component_id = c.id
WHERE e.path LIKE '%/scripts/%' OR e.path LIKE '%/script/%';

-- 7. WebSocket event analysis
SELECT 
    c.name,
    w.event_name,
    w.direction,
    w.description
FROM websocket_events w
JOIN components c ON w.component_id = c.id
ORDER BY c.name, w.event_name;

-- 8. Find potential API versioning issues
SELECT 
    e1.path as endpoint1,
    e2.path as endpoint2,
    c.name as component
FROM api_endpoints e1
JOIN api_endpoints e2 ON e1.component_id = e2.component_id 
    AND e1.id < e2.id
    AND e1.method = e2.method
JOIN components c ON e1.component_id = c.id
WHERE 
    (e1.path LIKE '%/v1/%' AND e2.path LIKE '%/v2/%')
    OR (e1.path LIKE '%/api/%' AND e2.path LIKE '%/api/v2/%');

-- 9. Security audit - find unauthenticated endpoints
SELECT 
    c.name as component,
    e.method,
    e.path,
    COUNT(p.id) as param_count
FROM api_endpoints e
JOIN components c ON e.component_id = c.id
LEFT JOIN api_parameters p ON e.id = p.endpoint_id
WHERE e.is_authenticated = FALSE
GROUP BY e.id
ORDER BY c.name, e.path;

-- 10. API documentation generator query
SELECT 
    c.name as component,
    e.method,
    e.path,
    e.description,
    e.is_authenticated,
    e.auth_type,
    GROUP_CONCAT(
        p.name || ' (' || p.location || ', ' || 
        CASE WHEN p.required THEN 'required' ELSE 'optional' END || ')'
        , ', '
    ) as parameters
FROM api_endpoints e
JOIN components c ON e.component_id = c.id
LEFT JOIN api_parameters p ON e.id = p.endpoint_id
GROUP BY e.id
ORDER BY c.name, e.path; 