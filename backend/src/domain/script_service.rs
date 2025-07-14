//! Script domain service for business logic.
//!
//! Contains the core business logic for script operations, independent of
//! infrastructure concerns like database access or HTTP handling.

use std::sync::Arc;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::script::Script;
use crate::repositories::script_repository::ScriptRepository;
use crate::repositories::user_repository::UserRepository;
use crate::repositories::block_repository::BlockRepository;

/// Request for creating a new script
#[derive(Debug, Clone)]
pub struct CreateScriptRequest {
    pub title: String,
    pub content: Option<String>,
    pub user_id: Uuid,
}

/// Request for updating a script
#[derive(Debug, Clone)]
pub struct UpdateScriptRequest {
    pub id: Uuid,
    pub title: Option<String>,
    pub content: Option<String>,
    pub user_id: Uuid, // For authorization
}

/// Response for script operations
#[derive(Debug, Clone)]
pub struct ScriptResponse {
    pub id: Uuid,
    pub title: String,
    pub created_by: Option<Uuid>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_public: Option<bool>,
    pub thumbnail: Option<String>,
}

impl From<Script> for ScriptResponse {
    fn from(script: Script) -> Self {
        Self {
            id: script.id,
            title: script.title,
            created_by: script.created_by,
            created_at: script.created_at,
            is_public: script.is_public,
            thumbnail: script.thumbnail,
        }
    }
}

/// Domain service for script operations
pub struct ScriptService {
    script_repo: Arc<dyn ScriptRepository>,
    user_repo: Arc<dyn UserRepository>,
    block_repo: Arc<dyn BlockRepository>,
}

impl ScriptService {
    pub fn new(
        script_repo: Arc<dyn ScriptRepository>,
        user_repo: Arc<dyn UserRepository>,
        block_repo: Arc<dyn BlockRepository>,
    ) -> Self {
        Self {
            script_repo,
            user_repo,
            block_repo,
        }
    }
    
    /// Create a new script
    pub async fn create_script(&self, request: CreateScriptRequest) -> Result<ScriptResponse, AppError> {
        // Validate user exists
        let user = self.user_repo.find_by_id(request.user_id).await?;
        if user.is_none() {
            return Err(AppError::NotFound("User not found".to_string()));
        }
        
        // Business rule: Title must not be empty
        if request.title.trim().is_empty() {
            return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
        }
        
        // Business rule: Title must be unique for the user
        let existing_scripts = self.script_repo.find_by_user_id(request.user_id).await?;
        if existing_scripts.iter().any(|s| s.title == request.title) {
            return Err(AppError::Conflict("Script with this title already exists".to_string()));
        }
        
        // Create the script
        let now = chrono::Utc::now();
        let script = Script {
            id: Uuid::new_v4(),
            title: request.title,
            created_by: Some(request.user_id),
            created_at: Some(now),
            is_public: Some(false),
            thumbnail: None,
        };
        
        self.script_repo.create(&script).await?;
        
        Ok(ScriptResponse::from(script))
    }
    
    /// Get a script by ID
    pub async fn get_script(&self, id: Uuid) -> Result<ScriptResponse, AppError> {
        let script = self.script_repo.find_by_id(id).await?;
        match script {
            Some(script) => Ok(ScriptResponse::from(script)),
            None => Err(AppError::NotFound("Script not found".to_string())),
        }
    }
    
    /// Update a script
    pub async fn update_script(&self, request: UpdateScriptRequest) -> Result<ScriptResponse, AppError> {
        // Get existing script
        let mut script = self.script_repo.find_by_id(request.id).await?;
        let mut script = match script {
            Some(script) => script,
            None => return Err(AppError::NotFound("Script not found".to_string())),
        };
        
        // Business rule: Only the owner can update the script
        if script.created_by != Some(request.user_id) {
            return Err(AppError::Forbidden("You can only update your own scripts".to_string()));
        }
        
        // Update fields if provided
        if let Some(title) = request.title {
            if title.trim().is_empty() {
                return Err(AppError::BadRequest("Script title cannot be empty".to_string()));
            }
            
            // Business rule: Title must be unique for the user (excluding current script)
            let existing_scripts = self.script_repo.find_by_user_id(request.user_id).await?;
            if existing_scripts.iter().any(|s| s.title == title && s.id != request.id) {
                return Err(AppError::Conflict("Script with this title already exists".to_string()));
            }
            
            script.title = title;
        }
        
        self.script_repo.update(&script).await?;
        
        Ok(ScriptResponse::from(script))
    }
    
    /// Delete a script
    pub async fn delete_script(&self, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        // Get existing script
        let script = self.script_repo.find_by_id(id).await?;
        let script = match script {
            Some(script) => script,
            None => return Err(AppError::NotFound("Script not found".to_string())),
        };
        
        // Business rule: Only the owner can delete the script
        if script.created_by != Some(user_id) {
            return Err(AppError::Forbidden("You can only delete your own scripts".to_string()));
        }
        
        self.script_repo.delete(id).await?;
        
        Ok(())
    }
    
    /// List scripts for a user
    pub async fn list_user_scripts(&self, user_id: Uuid) -> Result<Vec<ScriptResponse>, AppError> {
        let scripts = self.script_repo.find_by_user_id(user_id).await?;
        Ok(scripts.into_iter().map(ScriptResponse::from).collect())
    }
    
    /// Search scripts by title pattern
    pub async fn search_scripts(&self, pattern: &str) -> Result<Vec<ScriptResponse>, AppError> {
        let scripts = self.script_repo.find_by_title_pattern(pattern).await?;
        Ok(scripts.into_iter().map(ScriptResponse::from).collect())
    }

    // ============================================================================
    // Application Service Support Methods
    // ============================================================================

    /// Validates that a user can create a script
    pub async fn validate_script_creation(&self, user_id: Uuid) -> Result<(), AppError> {
        // Ensure user exists
        let user = self.user_repo.find_by_id(user_id).await?;
        if user.is_none() {
            return Err(AppError::NotFound("User not found".to_string()));
        }

        // Business rule: Check if user has reached script limit (if any)
        // For now, we'll allow unlimited scripts but this can be extended
        Ok(())
    }

    /// Verifies that a user owns a script
    pub async fn verify_script_ownership(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        let script = self.script_repo.find_by_id(script_id).await?;
        let script = match script {
            Some(script) => script,
            None => return Err(AppError::NotFound("Script not found".to_string())),
        };

        if script.created_by != Some(user_id) {
            return Err(AppError::Forbidden("You don't have permission to access this script".to_string()));
        }

        Ok(())
    }

    /// Validates script sharing business rules
    pub async fn validate_script_sharing(&self, script_id: Uuid, user_id: Uuid, target_username: &str) -> Result<(), AppError> {
        // Verify script exists and user owns it
        self.verify_script_ownership(script_id, user_id).await?;

        // Verify target user exists
        let target_user = self.user_repo.find_by_email(target_username).await?;
        if target_user.is_none() {
            return Err(AppError::NotFound("Target user not found".to_string()));
        }

        // Business rule: Cannot share with yourself (handled in application service)
        
        Ok(())
    }

    /// Validates public toggle business rules
    pub async fn validate_public_toggle(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        // Verify ownership
        self.verify_script_ownership(script_id, user_id).await?;

        // Additional business rules for public scripts can be added here
        // For example: check if script meets quality standards, has minimum content, etc.
        
        Ok(())
    }

    /// Verifies that a user has access to a script (ownership, sharing, or public)
    pub async fn verify_script_access(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        // Check ownership first
        if self.verify_script_ownership(script_id, user_id).await.is_ok() {
            return Ok(());
        }

        // For now, we'll just check ownership
        // In a real implementation, this would check sharing permissions and public status
        // through the database or additional repositories
        
        Err(AppError::Forbidden("Access denied".to_string()))
    }

    /// Verifies that a user has write access to a script
    pub async fn verify_script_write_access(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        // Check ownership first
        if self.verify_script_ownership(script_id, user_id).await.is_ok() {
            return Ok(());
        }

        // For now, we'll just check ownership
        // In a real implementation, this would check write sharing permissions
        // through the database or additional repositories
        
        Err(AppError::Forbidden("Write access denied".to_string()))
    }

    /// Validates thumbnail generation business rules
    pub async fn validate_thumbnail_generation(&self, script_id: Uuid, user_id: Uuid) -> Result<(), AppError> {
        // Verify script access
        self.verify_script_access(script_id, user_id).await?;

        // Business rule: Script must have content to generate thumbnail
        let script = self.script_repo.find_by_id(script_id).await?;
        let script = script.ok_or_else(|| AppError::NotFound("Script not found".to_string()))?;

        // Check if script has blocks with content
        let blocks = self.block_repo.find_by_script_id(script_id).await?;
        if blocks.is_empty() {
            return Err(AppError::BadRequest("Script must have content to generate thumbnail".to_string()));
        }

        Ok(())
    }

    /// Validates bulk thumbnail generation business rules
    pub async fn validate_bulk_thumbnail_generation(&self, user_id: Uuid) -> Result<(), AppError> {
        // Verify user exists
        let user = self.user_repo.find_by_id(user_id).await?;
        if user.is_none() {
            return Err(AppError::NotFound("User not found".to_string()));
        }

        // Business rule: Only admins can generate bulk thumbnails
        // This is a placeholder - in a real implementation, check user role
        
        Ok(())
    }

    /// Validates bulk thumbnail regeneration business rules
    pub async fn validate_bulk_thumbnail_regeneration(&self, user_id: Uuid) -> Result<(), AppError> {
        // Verify user exists
        let user = self.user_repo.find_by_id(user_id).await?;
        if user.is_none() {
            return Err(AppError::NotFound("User not found".to_string()));
        }

        // Business rule: Only admins can regenerate all thumbnails
        // This is a placeholder - in a real implementation, check user role
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::script_repository::tests::MockScriptRepository;
    use crate::repositories::user_repository::tests::MockUserRepository;
    
    // Simple mock for testing - just returns empty results
    struct MockBlockRepository;
    
    impl MockBlockRepository {
        fn new() -> Self {
            Self
        }
    }
    
    #[async_trait::async_trait]
    impl BlockRepository for MockBlockRepository {
        async fn find_by_script_id(&self, _script_id: Uuid) -> Result<Vec<crate::models::block::Block>, crate::error::AppError> {
            Ok(vec![])
        }
        
        async fn create(&self, _block: crate::models::block::Block) -> Result<crate::models::block::Block, crate::error::AppError> {
            unimplemented!()
        }
        
        async fn update(&self, _block: crate::models::block::Block) -> Result<crate::models::block::Block, crate::error::AppError> {
            unimplemented!()
        }
        
        async fn delete(&self, _id: Uuid) -> Result<(), crate::error::AppError> {
            unimplemented!()
        }
    }
    use crate::models::user::User;
    use chrono::Utc;
    
    fn create_test_user() -> User {
        User {
            id: Uuid::new_v4(),
            email: "test@example.com".to_string(),
            username: "testuser".to_string(),
            password_hash: "hash".to_string(),
            role: "user".to_string(),
            created_at: Some(Utc::now()),
        }
    }
    
    #[tokio::test]
    async fn test_create_script_success() {
        let user = create_test_user();
        let user_repo = Arc::new(MockUserRepository::with_users(vec![user.clone()]));
        let script_repo = Arc::new(MockScriptRepository::new());
        let block_repo = Arc::new(MockBlockRepository::new());
        let service = ScriptService::new(script_repo, user_repo, block_repo);
        
        let request = CreateScriptRequest {
            title: "Test Script".to_string(),
            content: Some("Test content".to_string()),
            user_id: user.id,
        };
        
        let result = service.create_script(request).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response.title, "Test Script");
        assert_eq!(response.content, Some("Test content".to_string()));
        assert_eq!(response.user_id, user.id);
    }
    
    #[tokio::test]
    async fn test_create_script_empty_title() {
        let user = create_test_user();
        let user_repo = Arc::new(MockUserRepository::with_users(vec![user.clone()]));
        let script_repo = Arc::new(MockScriptRepository::new());
        let block_repo = Arc::new(MockBlockRepository::new());
        let service = ScriptService::new(script_repo, user_repo, block_repo);
        
        let request = CreateScriptRequest {
            title: "".to_string(),
            content: Some("Test content".to_string()),
            user_id: user.id,
        };
        
        let result = service.create_script(request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::BadRequest(_)));
    }
    
    #[tokio::test]
    async fn test_create_script_user_not_found() {
        let user_repo = Arc::new(MockUserRepository::new());
        let script_repo = Arc::new(MockScriptRepository::new());
        let block_repo = Arc::new(MockBlockRepository::new());
        let service = ScriptService::new(script_repo, user_repo, block_repo);
        
        let request = CreateScriptRequest {
            title: "Test Script".to_string(),
            content: Some("Test content".to_string()),
            user_id: Uuid::new_v4(),
        };
        
        let result = service.create_script(request).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::NotFound(_)));
    }
} 