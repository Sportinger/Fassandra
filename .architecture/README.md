# Architecture Knowledge Base

This directory contains the architectural knowledge database for the Pessoa Theater Platform.

## Structure

- `knowledge.db` - SQLite database with architectural information
- `schema.sql` - Database schema with improved structure
- `example_queries.sql` - Example queries showing how to use the database
- `test_data.sql` - Sample data for testing (can be deleted in production)

## Key Improvements

The knowledge base uses separate tables for better queryability:

1. **components** - Services, databases, and other architectural elements
2. **api_endpoints** - Detailed API endpoint documentation (method, path, auth)
3. **api_parameters** - Parameters for each endpoint with validation rules
4. **websocket_events** - Real-time event documentation
5. **relationships** - How components connect to each other
6. **observations** - Architectural patterns and decisions

## Usage

```bash
# View all API endpoints
sqlite3 knowledge.db "SELECT * FROM api_endpoints;"

# Find endpoints by parameter
sqlite3 knowledge.db "SELECT e.* FROM api_endpoints e JOIN api_parameters p ON e.id = p.endpoint_id WHERE p.name = 'script_id';"

# Analyze component complexity
sqlite3 knowledge.db < example_queries.sql
```

## Benefits

- **Queryable**: Find endpoints by method, parameter, or authentication type
- **Analyzable**: Calculate API complexity, find security issues
- **Maintainable**: Clear structure with referential integrity
- **Extensible**: Easy to add new tables for additional metadata 