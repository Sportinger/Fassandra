-- Test: Adding new components to see real-time updates in visualizer
-- Run this while the visualizer is open to see live changes!

BEGIN TRANSACTION;

-- Add a new caching layer component
INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) 
VALUES ('redis-cache', 'cache', 'High-performance caching for API responses', 'Redis 7.0', 'infrastructure', 'cache', FALSE, 'Pessoa Theater Platform');

-- Add a message queue
INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) 
VALUES ('rabbitmq', 'queue', 'Asynchronous task processing', 'RabbitMQ 3.12', 'infrastructure', 'queue', FALSE, 'Pessoa Theater Platform');

-- Add a monitoring service
INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) 
VALUES ('prometheus', 'monitoring', 'Metrics collection and monitoring', 'Prometheus, Grafana', 'infrastructure', 'monitoring', FALSE, 'Pessoa Theater Platform');

-- Add relationships for the new components
INSERT INTO relationships (source_component_id, target_component_id, relationship_type, direction, protocol, technology, data_flow) VALUES
-- Backend uses Redis for caching
((SELECT id FROM components WHERE name = 'backend-service'), 
 (SELECT id FROM components WHERE name = 'redis-cache'), 
 'cache', 'backend->cache', 'TCP', 'Redis Protocol', 'Cache queries'),

-- Backend publishes to RabbitMQ
((SELECT id FROM components WHERE name = 'backend-service'), 
 (SELECT id FROM components WHERE name = 'rabbitmq'), 
 'publish', 'backend->queue', 'AMQP', 'RabbitMQ', 'Task messages'),

-- Monitoring scrapes metrics from all services
((SELECT id FROM components WHERE name = 'prometheus'), 
 (SELECT id FROM components WHERE name = 'backend-service'), 
 'scrape', 'monitoring->backend', 'HTTP', 'Prometheus', 'Metrics pull'),
((SELECT id FROM components WHERE name = 'prometheus'), 
 (SELECT id FROM components WHERE name = 'frontend-app'), 
 'scrape', 'monitoring->frontend', 'HTTP', 'Prometheus', 'Metrics pull');

-- Add deployments for new components
INSERT INTO deployments (component_id, environment, host, port, replicas, infrastructure_type) VALUES
((SELECT id FROM components WHERE name = 'redis-cache'), 'prod', 'cache.internal', 6379, 2, 'docker-compose'),
((SELECT id FROM components WHERE name = 'rabbitmq'), 'prod', 'queue.internal', 5672, 1, 'docker-compose'),
((SELECT id FROM components WHERE name = 'prometheus'), 'prod', 'metrics.internal', 9090, 1, 'docker-compose');

-- Add an observation about the new architecture
INSERT INTO observations (observation_type, description, confidence, evidence) VALUES
('enhancement', 'Added caching and message queue infrastructure for improved performance and scalability', 1.0, 'Redis cache and RabbitMQ integration');

COMMIT;

-- Show what was added
SELECT '=== New Components Added ===' as info;
SELECT name, type, layer FROM components WHERE name IN ('redis-cache', 'rabbitmq', 'prometheus');

SELECT '=== Updated Relationships ===' as info;
SELECT 
    c1.name || ' --> ' || c2.name || ' (' || r.protocol || ')' as relationship
FROM relationships r
JOIN components c1 ON r.source_component_id = c1.id
JOIN components c2 ON r.target_component_id = c2.id
WHERE c1.name IN ('backend-service', 'prometheus') 
  AND c2.name IN ('redis-cache', 'rabbitmq', 'backend-service', 'frontend-app')
ORDER BY relationship; 