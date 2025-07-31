#!/bin/bash

echo "🚀 Real-time Update Test"
echo "========================"
echo ""
echo "This test will add components one by one to show instant updates."
echo "Make sure the visualizer is running at http://localhost:3456"
echo ""
echo "Press Enter to start..."
read

echo "➕ Adding Redis Cache..."
sqlite3 knowledge.db "INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) 
VALUES ('redis-test-1', 'cache', 'Test cache 1', 'Redis', 'infrastructure', 'cache', FALSE, 'Pessoa Theater Platform');"

sleep 2

echo "➕ Adding Message Queue..."
sqlite3 knowledge.db "INSERT INTO components (name, type, purpose, technology_stack, layer, container_type, external, system_boundary) 
VALUES ('rabbitmq-test-1', 'queue', 'Test queue 1', 'RabbitMQ', 'infrastructure', 'queue', FALSE, 'Pessoa Theater Platform');"

sleep 2

echo "➕ Adding relationship..."
sqlite3 knowledge.db "INSERT INTO relationships (source_component_id, target_component_id, relationship_type, direction, protocol, technology) 
SELECT c1.id, c2.id, 'cache', 'backend->cache', 'TCP', 'Redis' 
FROM components c1, components c2 
WHERE c1.name = 'backend-service' AND c2.name = 'redis-test-1';"

echo ""
echo "✅ Done! You should have seen the components appear instantly in the visualizer."
echo ""
echo "🧹 To clean up test components:"
echo "   sqlite3 knowledge.db \"DELETE FROM components WHERE name LIKE '%-test-1';\"" 