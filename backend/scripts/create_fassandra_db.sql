-- Create Fassandra database role and database (development defaults)
-- Adjust passwords and names as needed for your environment.

-- Create role if it does not exist
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fassandra_user') THEN
      CREATE ROLE fassandra_user LOGIN PASSWORD 'dev_password_123';
   END IF;
END
$$;

-- Create database if it does not exist and assign owner
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'fassandra_db') THEN
      CREATE DATABASE fassandra_db OWNER fassandra_user ENCODING 'UTF8' TEMPLATE template0;
   END IF;
END
$$;

-- Ensure privileges
GRANT ALL PRIVILEGES ON DATABASE fassandra_db TO fassandra_user;

