# Code Issues Identified During Documentation Review (2024-06-28)

This file contains a list of potential issues identified during the process of adding and improving documentation to the codebase. These issues are not fixed as per the instructions to not change any code or definitions, but are documented here for future reference.

## Security Issues

1. **Password Storage**: In `backend/src/api/auth.rs`, passwords are stored directly rather than being properly hashed:
   ```rust
   pub async fn register(pool: &PgPool, email: &str, password: &str) -> Result<User, AppError> {
       let user = User {
           // ...
           password_hash: password.to_string(), // In production, hash the password
           // ...
       };
       // ...
   }
   ```
   **Recommendation**: Use the `hash_password` function from `auth.rs` to hash passwords before storing them.

2. **Insecure Authentication**: In `backend/src/api/auth.rs`, login directly compares plaintext passwords:
   ```rust
   pub async fn login(pool: &PgPool, email: &str, password: &str) -> Result<User, AppError> {
       let user = sqlx::query_as::<_, User>(
           "SELECT * FROM users WHERE email = $1 AND password_hash = $2"
       )
       // ...
   }
   ```
   **Recommendation**: Use the `verify_password` function from `auth.rs` to verify passwords, as is done in the main application.

## Code Consistency Issues

1. **Inconsistent API Patterns**: `backend/src/main.rs` has an inconsistency where `update_script_title_endpoint` calls `update_script` but requires a transformation of the payload.
   **Recommendation**: Standardize API naming and payload structures.

2. **Redundant Code**: There are both `backend/src/api/auth.rs` functions and direct authentication functions in `backend/src/main.rs` that perform similar tasks but with different implementations.
   **Recommendation**: Consolidate authentication logic in one place and make it consistent.

3. **Triple Quotes Syntax Error**: In `backend/src/handlers/script_handlers.rs`, the module docstring incorrectly used triple quotes which is a Python convention, not Rust.
   **Recommendation**: Use the standard Rust docstring format with `//!` for module documentation.

## Potential Bugs

1. **Missing Authorization Checks**: Several endpoints don't verify that a user has permission to access or modify a resource. For example, in `update_script`, there's no check that the authenticated user owns the script being modified.
   **Recommendation**: Add authorization checks to ensure users can only access their own resources.

2. **Test Mode in Production Code**: In `backend/src/handlers/script_handlers.rs`, there's code that only processes 1/4 of the script text, labeled as "FOR TESTING". This should not be in production code.
   **Recommendation**: Remove testing code or make it conditional based on environment variables.

## Documentation Issues

1. **Incomplete Documentation**: Some parameters and return values need more detailed descriptions.
   **Recommendation**: Continue to expand documentation with more specific details about parameter requirements and constraints.

2. **Inconsistent Documentation Style**: Some docstrings use periods at the end of sentences and some don't. The format of argument and return value descriptions varies slightly across files.
   **Recommendation**: Adopt a consistent documentation style guide for the project.

## Compilation Issues

1. **Missing Clone Implementation**: In `backend/src/main.rs`, the `RateLimiter` is being cloned but doesn't implement the `Clone` trait:
   ```rust
   .with_state(rate_limiter);
   ```
   ```
   the trait bound `RateLimiter: Clone` is not satisfied
   the trait `Clone` is not implemented for `RateLimiter`
   ```
   **Recommendation**: Implement Clone for RateLimiter or use Arc to share it across state.

## Testing Considerations

1. **Missing Test Coverage**: Many functions lack corresponding tests, especially error handling cases.
   **Recommendation**: Add comprehensive tests for all API endpoints and utilities. 