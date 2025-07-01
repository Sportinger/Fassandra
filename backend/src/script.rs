/// Retrieves a script by its unique identifier from the database.
///
/// # Arguments
/// * `db` - Database connection manager
/// * `script_id` - The ID of the script to retrieve
///
/// # Returns
/// * `Result<Option<Script>, Box<dyn std::error::Error>>` - The script if found, or None if not found
///
/// # Errors
/// Returns an error if the database operation fails
pub async fn get_script_by_id(
    db: &Database,
    script_id: i32,
) -> Result<Option<Script>, Box<dyn std::error::Error>> {
    let mut conn = db.get_connection().await?;
    let script = sqlx::query_as!(
        Script,
        r#"
        SELECT id, name, description, content, created_at, updated_at, user_id
        FROM scripts
        WHERE id = $1
        "#,
        script_id
    )
    .fetch_optional(&mut conn)
    .await?;
    Ok(script)
} 