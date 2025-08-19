use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tokio::time::Duration;
use tokio::task::JoinHandle;
// Tracing imports removed - not currently used
use anyhow::Result;

use crate::services::persistence_event::YjsPersistenceEvent;
use crate::auth::RateLimiter;
use crate::services::async_db_writer::run_async_db_writer;
use crate::services::yjs_compaction_service::CompactionService;
use crate::services::claude_session_service::ClaudeSessionService;

/// 🚀 SERVICE MANAGER: Centralized service initialization and lifecycle management
/// This solves the tight coupling problem by providing a single point for service dependency injection
#[derive(Debug)]
pub struct ServiceManager {
    // Core database connection
    pub database_pool: Arc<PgPool>,
    
    // Service components
    pub rate_limiter: Arc<RateLimiter>,
    pub persistence_tx: mpsc::Sender<YjsPersistenceEvent>,
    pub claude_session_service: Arc<ClaudeSessionService>,
    
    // Background service handles for graceful shutdown
    service_handles: Vec<JoinHandle<()>>,
}

impl ServiceManager {
    /// Creates a new ServiceManager with all services initialized
    /// 
    /// # Arguments
    /// * `pool` - Database connection pool
    /// * `rate_limit_window` - Rate limiting time window
    /// * `rate_limit_max` - Maximum requests per window
    /// 
    /// # Returns
    /// * `Result<ServiceManager>` - Configured service manager
    pub async fn new(
        pool: PgPool,
        rate_limit_window: Duration,
        rate_limit_max: usize,
    ) -> Result<Self> {
        tracing::info!("🚀 ServiceManager: Initializing services...");
        
        // Create shared database pool
        let database_pool = Arc::new(pool);
        
        // Initialize rate limiter with cleanup
        let rate_limiter = Arc::new(RateLimiter::new(rate_limit_window, rate_limit_max));
        
        // Create persistence event channel
        let (persistence_tx, persistence_rx) = 
            mpsc::channel::<YjsPersistenceEvent>(1024);
        
        // Initialize Claude session service
        let claude_session_service = Arc::new(ClaudeSessionService::new());
        
        let mut service_manager = ServiceManager {
            database_pool,
            rate_limiter,
            persistence_tx,
            claude_session_service,
            service_handles: Vec::new(),
        };
        
        // Start all background services
        service_manager.start_background_services(persistence_rx).await?;
        
        tracing::info!("✅ ServiceManager: All services initialized successfully");
        Ok(service_manager)
    }
    
    /// Starts all background services with proper error handling
    async fn start_background_services(
        &mut self, 
        persistence_rx: mpsc::Receiver<YjsPersistenceEvent>
    ) -> Result<()> {
        // 1. Start async database writer
        let db_pool_writer = self.database_pool.clone();
        let writer_handle = tokio::spawn(async move {
            tracing::info!("🚀 Starting Async DB Writer service");
            run_async_db_writer(persistence_rx, (*db_pool_writer).clone()).await;
            tracing::warn!("⚠️ Async DB Writer service stopped");
        });
        self.service_handles.push(writer_handle);
        
        // 2. Start YJS compaction service
        let db_pool_compaction = self.database_pool.clone();
        let compaction_handle = tokio::spawn(async move {
            tracing::info!("🚀 Starting YJS Compaction service");
            let compaction_service = Arc::new(CompactionService::new(db_pool_compaction));
            compaction_service.run().await;
            tracing::warn!("⚠️ YJS Compaction service stopped");
        });
        self.service_handles.push(compaction_handle);
        
        // 3. Start rate limiter cleanup
        let rate_limiter_cleanup = self.rate_limiter.clone();
        let cleanup_handle = tokio::spawn(async move {
            tracing::info!("🚀 Starting RateLimiter cleanup service");
            let mut interval = tokio::time::interval(Duration::from_secs(1800)); // 30 minutes
            loop {
                interval.tick().await;
                match rate_limiter_cleanup.cleanup_old_data().await {
                    Ok(removed) => {
                        if removed > 0 {
                            tracing::debug!("🧹 RateLimiter cleanup: removed {} old entries", removed);
                        }
                    }
                    Err(e) => tracing::error!("❌ RateLimiter cleanup failed: {}", e),
                }
            }
        });
        self.service_handles.push(cleanup_handle);
        
        // 4. Start WebSocket session cleanup
        let ws_cleanup_handle = tokio::spawn(async move {
            tracing::info!("🚀 Starting WebSocket session cleanup service");
            let mut interval = tokio::time::interval(Duration::from_secs(60)); // Check every minute
            let inactive_threshold = chrono::Duration::minutes(5); // Remove sessions inactive for 5+ minutes
            
            loop {
                interval.tick().await;
                match crate::networking::cleanup_inactive_sessions(inactive_threshold).await {
                    Ok(removed_count) => {
                        if removed_count > 0 {
                            tracing::info!("🧹 WebSocket cleanup: removed {} inactive sessions", removed_count);
                        } else {
                            tracing::debug!("🧹 WebSocket cleanup: no inactive sessions to remove");
                        }
                    }
                    Err(e) => {
                        tracing::error!("❌ WebSocket cleanup error: {}", e);
                    }
                }
            }
        });
        self.service_handles.push(ws_cleanup_handle);
        
        // 5. Start Claude session cleanup
        let claude_service_cleanup = self.claude_session_service.clone();
        let claude_cleanup_handle = tokio::spawn(async move {
            tracing::info!("🚀 Starting Claude session cleanup service");
            let mut interval = tokio::time::interval(Duration::from_secs(3600)); // 1 hour
            loop {
                interval.tick().await;
                claude_service_cleanup.cleanup_old_sessions(24).await; // Clean up sessions older than 24 hours
                tracing::debug!("🧹 Claude session cleanup: completed");
            }
        });
        self.service_handles.push(claude_cleanup_handle);
        
        tracing::info!("✅ All {} background services started", self.service_handles.len());
        Ok(())
    }
    
    /// Gets a clone of the database pool for use in handlers
    /// This reduces the need for Arc<PgPool> everywhere
    pub fn get_database_pool(&self) -> PgPool {
        (*self.database_pool).clone()
    }
    
    /// Gets the rate limiter for middleware
    pub fn get_rate_limiter(&self) -> Arc<RateLimiter> {
        self.rate_limiter.clone()
    }
    
    /// Gets the persistence event sender
    pub fn get_persistence_sender(&self) -> mpsc::Sender<YjsPersistenceEvent> {
        self.persistence_tx.clone()
    }
    
    /// Gets the Claude session service
    pub fn get_claude_session_service(&self) -> Arc<ClaudeSessionService> {
        self.claude_session_service.clone()
    }
    
    /// Gets script services container for dependency injection
    pub fn get_script_services(&self) -> crate::handlers::script::ScriptServices {
        self.create_script_services_internal()
    }
    
    /// Gets extended script services with Claude session support
    pub fn get_extended_script_services(&self) -> crate::handlers::script_upload_handler::ExtendedScriptServices {
        crate::handlers::script_upload_handler::ExtendedScriptServices {
            script_services: self.get_script_services(),
            claude_session_service: self.claude_session_service.clone(),
        }
    }

    /// Creates script services with proper dependency injection
    /// 
    /// This function wires up the application services layer with all necessary dependencies.
    /// It follows the dependency injection pattern to ensure clean separation of concerns.
    fn create_script_services_internal(&self) -> crate::handlers::script::ScriptServices {
        // Create repository layer
        let script_repo = std::sync::Arc::new(crate::repositories::script_repository::PostgresScriptRepository::new(self.database_pool.clone()));
        let user_repo = std::sync::Arc::new(crate::repositories::user_repository::PostgresUserRepository::new(self.database_pool.clone()));
        let block_repo = std::sync::Arc::new(crate::repositories::block_repository::PostgresBlockRepository::new(self.database_pool.clone()));
        let _yjs_repo = std::sync::Arc::new(crate::repositories::yjs_update_repository::PostgresYjsUpdateRepository::new(self.database_pool.clone()));

        // Create domain services layer
        let script_domain_service = std::sync::Arc::new(crate::domain::script_service::ScriptService::new(
            script_repo.clone(),
            user_repo.clone(),
            block_repo.clone(),
        ));

        // Create application services layer
        let script_service = std::sync::Arc::new(crate::application::ScriptApplicationService::new(
            script_domain_service.clone(),
            self.database_pool.clone(),
        ));

        let sharing_service = std::sync::Arc::new(crate::application::ScriptSharingApplicationService::new(
            script_domain_service.clone(),
            self.database_pool.clone(),
        ));

        let thumbnail_service = std::sync::Arc::new(crate::application::ThumbnailApplicationService::new(
            script_domain_service.clone(),
            self.database_pool.clone(),
        ));

        // Return the services container
        crate::handlers::script::ScriptServices {
            script_service,
            sharing_service,
            thumbnail_service,
        }
    }
    
    /// Performs graceful shutdown of all services
    pub async fn shutdown(self) -> Result<()> {
        tracing::info!("🛑 ServiceManager: Starting graceful shutdown...");
        
        // Cancel all background services
        for handle in self.service_handles {
            handle.abort();
        }
        
        // Wait a moment for services to clean up
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        tracing::info!("✅ ServiceManager: Graceful shutdown completed");
        Ok(())
    }
    
    /// Health check for all managed services
    pub async fn health_check(&self) -> ServiceHealthStatus {
        let database = self.check_database_health().await;
        let rate_limiter = self.check_rate_limiter_health().await;
        let persistence_writer = self.check_persistence_health().await;
        let active_services = self.service_handles.len();
        
        ServiceHealthStatus {
            overall_healthy: database && rate_limiter && persistence_writer,
            database,
            rate_limiter,
            persistence_writer,
            active_services,
        }
    }
    
    async fn check_database_health(&self) -> bool {
        // Simple query to check database connectivity
        match sqlx::query("SELECT 1").fetch_one(self.database_pool.as_ref()).await {
            Ok(_) => true,
            Err(e) => {
                tracing::error!("❌ Database health check failed: {}", e);
                false
            }
        }
    }
    
    async fn check_rate_limiter_health(&self) -> bool {
        // Rate limiter is always healthy if it exists
        true
    }
    
    async fn check_persistence_health(&self) -> bool {
        // Check if the persistence channel is still open
        !self.persistence_tx.is_closed()
    }
}

/// Health status for service manager
#[derive(Debug, Clone)]
pub struct ServiceHealthStatus {
    pub overall_healthy: bool,
    pub database: bool,
    pub rate_limiter: bool,
    pub persistence_writer: bool,
    pub active_services: usize,
}

impl ServiceHealthStatus {
    pub fn is_healthy(&self) -> bool {
        self.overall_healthy
    }
    
    pub fn get_status_summary(&self) -> String {
        format!(
            "Database: {}, RateLimiter: {}, Persistence: {}, Services: {}",
            if self.database { "✅" } else { "❌" },
            if self.rate_limiter { "✅" } else { "❌" },
            if self.persistence_writer { "✅" } else { "❌" },
            self.active_services
        )
    }
}

/// Create service manager with production configuration
pub async fn create_production_service_manager(pool: PgPool) -> Result<ServiceManager> {
    ServiceManager::new(
        pool,
        Duration::from_secs(60),  // 1 minute rate limit window
        500,                      // 500 requests per minute max (increased for development)
    ).await
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_service_health_status() {
        let status = ServiceHealthStatus {
            overall_healthy: true,
            database: true,
            rate_limiter: true,
            persistence_writer: true,
            active_services: 4,
        };
        
        assert!(status.is_healthy());
        assert!(status.get_status_summary().contains("✅"));
    }
} 