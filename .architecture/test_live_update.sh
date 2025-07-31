#!/bin/bash

echo "🧪 Architecture Live Update Test"
echo "================================"
echo ""
echo "This test will add new components to demonstrate real-time updates."
echo "Make sure the visualizer is running at http://localhost:3456"
echo ""
echo "Press Enter to start the test..."
read

echo "📊 Current component count:"
sqlite3 knowledge.db "SELECT COUNT(*) || ' components' FROM components;"

echo ""
echo "➕ Adding new components (Redis, RabbitMQ, Prometheus)..."
sqlite3 knowledge.db < test_add_components.sql

echo ""
echo "✅ Components added! Check the visualizer - it should update within 5 seconds."
echo ""
echo "📊 New component count:"
sqlite3 knowledge.db "SELECT COUNT(*) || ' components' FROM components;"

echo ""
echo "🔄 To remove test components and restore original state:"
echo "   sqlite3 knowledge.db < restore_original.sql" 