# Branch Change Overview: Universal Script Access and Editability

This document outlines the changes made to the Pessoa application to enable all authenticated users to view, edit, and delete any script, moving away from a user-specific ownership model for these actions. It also details the necessary steps taken to ensure the backend build process was successful after these modifications.

## Goal

The primary objective was to modify the backend API so that:
1.  All scripts are listed and viewable by any authenticated user.
2.  All scripts' titles and content (blocks) can be edited by any authenticated user.
3.  Any script can be deleted by any authenticated user.
4.  The `created_by` field on scripts and `user_id` on edits are retained for attribution.

## Backend Code Modifications

Changes were primarily made in `.rs` files within the `backend/src/` directory.

### 1. `backend/src/lib.rs`

*   **`get_scripts` function:**
    *   Removed the `user_id: Uuid` parameter.
    *   Modified the SQL query from `SELECT ... WHERE created_by = $1 ...` to `SELECT id, title, created_by, created_at FROM scripts ORDER BY created_at DESC`.
    *   This allows the function to fetch all scripts, no longer filtering by the user who created them.

### 2. `backend/src/main.rs`

*   **`list_scripts` handler (for `GET /api/scripts`):**
    *   Changed the `AuthUser{user_id}: AuthUser` extractor to `AuthUser{user_id: _}: AuthUser`. This still enforces authentication but signals that the specific `user_id` is not used for data filtering within this handler.
    *   Updated the call to `get_scripts(&pool).await?`, removing the `user_id` argument to align with the modified `lib.rs` function.

*   **`get_script_endpoint` handler (for `GET /api/scripts/:id`):**
    *   Changed `AuthUser{user_id}: AuthUser` to `AuthUser{user_id: _}: AuthUser`.
    *   Updated the call to `get_script_with_blocks(&pool, script_id).await?`. The `get_script_with_blocks` function in `lib.rs` was confirmed to not filter the script itself by `user_id`, so this change primarily corrected the call signature from the handler.

*   **`update_script_title_endpoint` handler (for `PATCH /api/scripts/:id`):**
    *   Changed `AuthUser{user_id}: AuthUser` to `AuthUser{user_id: _}: AuthUser`.
    *   The body of the handler was entirely rewritten to execute a direct SQL query:
        ```sql
        UPDATE scripts SET title = $1 WHERE id = $2 RETURNING id, title, created_by, created_at
        ```
        This allows any authenticated user to update the title of any script, as the `user_id` is no longer part of an ownership check for this operation.

*   **`delete_script_endpoint` handler (for `DELETE /api/scripts/:id` - NEW):**
    *   A new asynchronous handler function `delete_script_endpoint` was created.
    *   It uses `AuthUser{user_id: _}: AuthUser` for authentication.
    *   It calls `crate::delete_script(&pool, script_id).await?` (which refers to `delete_script` from `lib.rs`). The `lib.rs` version of `delete_script` was already capable of deleting a script by its ID without checking user ownership.

*   **Router Configuration (in `main()`):**
    *   The `delete_script` function from `lib.rs` was added to the `use backend::{...};` import statement.
    *   The route for `/api/scripts/:id` was updated to include the new `delete_script_endpoint`:
        ```rust
        .route("/:id", get(get_script_endpoint).patch(update_script_title_endpoint).delete(delete_script_endpoint))
        ```

*   **No Changes Required for Block Editing Logic:**
    *   The `create_block_endpoint` (`POST /api/scripts/:id/blocks`) already allowed any authenticated user to create blocks.
    *   The `update_block_endpoint` (`PATCH /api/blocks/:id`) and its underlying `update_block` function in `lib.rs` already permitted any authenticated user to update block content. The `user_id` in this context was, and continues to be, used for attributing the edit in the `edits` table, not for authorizing the update itself.

## Build Process and `sqlx` Integration

Modifying SQL queries in files processed by `sqlx` requires updating its compile-time query cache. This led to a series of troubleshooting steps:

1.  **Initial `cargo sqlx prepare` Failure (Name Resolution):**
    *   **Problem:** `cargo sqlx prepare` (run on the host machine) couldn't resolve the hostname `db` in `DATABASE_URL=postgres://pessoa_user:theater@db:5432/pessoa_db` (meant for container-to-container communication).
    *   **Solution:** The command was modified to use `localhost` for the host machine context: `DATABASE_URL=postgres://pessoa_user:theater@localhost:5432/pessoa_db cargo sqlx prepare`.

2.  **Second `cargo sqlx prepare` Failure (Connection Refused):**
    *   **Problem:** The host machine couldn't connect to `localhost:5432` because the `pessoa_db` Docker container was not running, not yet fully initialized, or its port 5432 was not correctly mapped to the host.
    *   **Solution:** Ensured the `db` service was started using `docker compose up -d db`. Verified the `docker-compose.yml` correctly mapped port `5432:5432`. Confirmed via `docker compose logs db` that PostgreSQL initialized successfully and was listening on port 5432.

3.  **Third `cargo sqlx prepare` Failure (Relation Does Not Exist):**
    *   **Problem:** `sqlx` connected to the database but reported that tables like `scripts`, `blocks`, and `edits` did not exist. This was because the database schema had not been created (migrations had not been run). `sqlx prepare` needs the schema to exist to validate queries.
    *   **Solution:** Ran database migrations using `sqlx-cli` against the running `db` container: `DATABASE_URL=postgres://pessoa_user:theater@localhost:5432/pessoa_db sqlx database setup`. This created all necessary tables.

4.  **Successful `cargo sqlx prepare`:**
    *   After migrations were applied, `DATABASE_URL=postgres://pessoa_user:theater@localhost:5432/pessoa_db cargo sqlx prepare` ran successfully. This updated the `backend/.sqlx/query-data.json` file with the correct schema information.

5.  **Successful Docker Build:**
    *   With the updated `.sqlx` cache and modified Rust source files, `docker compose build backend` completed successfully. The Docker build process copies the `.sqlx` directory, allowing the Rust compiler within the Docker environment to perform its compile-time query checks.

These changes collectively achieve the desired outcome of making script viewing, editing, and deletion accessible to all authenticated users, while also ensuring the backend compiles and builds correctly with the updated SQL queries. 