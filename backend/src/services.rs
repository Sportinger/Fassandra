use std::sync::Arc;
use sqlx::PgPool;
use tokio::sync::mpsc;
use tokio::time::Duration;
use uuid::Uuid;
use anyhow;

use crate::persistence_event::YjsPersistenceEvent;
use crate::auth::RateLimiter;
use crate::error::AppError;

/// Service container trait for dependency injection
/// This allows proper testing and loose coupling between services
pub trait ServiceContainer: Send + Sync + Clone + 'static {
    type Database: DatabaseService;
    type RateLimiter: RateLimitService;
    type PersistenceWriter: PersistenceWriterService;
    type SnapshotService: SnapshotServiceTrait;
    
    fn database(&self) -> &Self::Database;
    fn rate_limiter(&self) -> &Self::RateLimiter;
    fn persistence_writer(&self) -> &Self::PersistenceWriter;
    fn snapshot_service(&self) -> &Self::SnapshotService;
}

/// Database service abstraction
/// This allows mocking for tests and different database implementations
pub trait DatabaseService: Send + Sync + Clone + 'static {
    async fn get_pool(&self) -> Result<PgPool, AppError>;
    async fn execute_query(&self, query: &str) -> Result<(), AppError>;
}

/// Rate limiting service abstraction
pub trait RateLimitService: Send + Sync + Clone + 'static {
    async fn check_rate_limit(&self, ip: &str) -> Result<bool, AppError>;
    async fn cleanup_old_data(&self) -> Result<(), AppError>;
}

/// Persistence writer service abstraction
pub trait PersistenceWriterService: Send + Sync + Clone + 'static {
    async fn write_persistence_event(&self, event: YjsPersistenceEvent) -> Result<(), AppError>;
    fn get_sender(&self) -> mpsc::Sender<YjsPersistenceEvent>;
}

/// Snapshot service abstraction
pub trait SnapshotServiceTrait: Send + Sync + Clone + 'static {
    async fn create_snapshot(&self, script_id: Uuid) -> Result<(), AppError>;
    async fn run_background_service(&self, interval: Duration);
}

/// Production service container implementation
#[derive(Clone)]
pub struct ProductionServiceContainer {
    database: ProductionDatabaseService,
    rate_limiter: ProductionRateLimitService,
    persistence_writer: ProductionPersistenceWriterService,
    snapshot_service: ProductionSnapshotService,
}

impl ProductionServiceContainer {
    pub fn new(
        pool: PgPool,
        rate_limiter: Arc<RateLimiter>,
        persistence_tx: mpsc::Sender<YjsPersistenceEvent>,
    ) -> Self {
        let database = ProductionDatabaseService::new(pool.clone());
        let rate_limiter_service = ProductionRateLimitService::new(rate_limiter);
        let persistence_writer = ProductionPersistenceWriterService::new(persistence_tx);
        let snapshot_service = ProductionSnapshotService::new(pool);
        
        Self {
            database,
            rate_limiter: rate_limiter_service,
            persistence_writer,
            snapshot_service,
        }
    }
}

impl ServiceContainer for ProductionServiceContainer {
    type Database = ProductionDatabaseService;
    type RateLimiter = ProductionRateLimitService;
    type PersistenceWriter = ProductionPersistenceWriterService;
    type SnapshotService = ProductionSnapshotService;
    
    fn database(&self) -> &Self::Database {
        &self.database
    }
    
    fn rate_limiter(&self) -> &Self::RateLimiter {
        &self.rate_limiter
    }
    
    fn persistence_writer(&self) -> &Self::PersistenceWriter {
        &self.persistence_writer
    }
    
    fn snapshot_service(&self) -> &Self::SnapshotService {
        &self.snapshot_service
    }
}

/// Production database service implementation
#[derive(Clone)]
pub struct ProductionDatabaseService {
    pool: PgPool,
}

impl ProductionDatabaseService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    pub fn get_pool_ref(&self) -> &PgPool {
        &self.pool
    }
}

impl DatabaseService for ProductionDatabaseService {
    async fn get_pool(&self) -> Result<PgPool, AppError> {
        Ok(self.pool.clone())
    }
    
    async fn execute_query(&self, query: &str) -> Result<(), AppError> {
        sqlx::query(query)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;
        Ok(())
    }
}

/// Production rate limiter service implementation
#[derive(Clone)]
pub struct ProductionRateLimitService {
    rate_limiter: Arc<RateLimiter>,
}

impl ProductionRateLimitService {
    pub fn new(rate_limiter: Arc<RateLimiter>) -> Self {
        Self { rate_limiter }
    }
    
    pub fn get_rate_limiter(&self) -> &Arc<RateLimiter> {
        &self.rate_limiter
    }
}

impl RateLimitService for ProductionRateLimitService {
    async fn check_rate_limit(&self, ip: &str) -> Result<bool, AppError> {
        match self.rate_limiter.check(ip).await {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    async fn cleanup_old_data(&self) -> Result<(), AppError> {
        self.rate_limiter.cleanup_old_data().await
            .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))
            .map(|_| ())
    }
}

/// Production persistence writer service implementation
#[derive(Clone)]
pub struct ProductionPersistenceWriterService {
    sender: mpsc::Sender<YjsPersistenceEvent>,
}

impl ProductionPersistenceWriterService {
    pub fn new(sender: mpsc::Sender<YjsPersistenceEvent>) -> Self {
        Self { sender }
    }
}

impl PersistenceWriterService for ProductionPersistenceWriterService {
    async fn write_persistence_event(&self, event: YjsPersistenceEvent) -> Result<(), AppError> {
        self.sender.send(event).await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to send persistence event: {}", e)))
    }
    
    fn get_sender(&self) -> mpsc::Sender<YjsPersistenceEvent> {
        self.sender.clone()
    }
}

/// Production snapshot service implementation
#[derive(Clone)]
pub struct ProductionSnapshotService {
    pool: PgPool,
}

impl ProductionSnapshotService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    
    pub fn get_pool(&self) -> &PgPool {
        &self.pool
    }
}

impl SnapshotServiceTrait for ProductionSnapshotService {
    async fn create_snapshot(&self, script_id: Uuid) -> Result<(), AppError> {
        crate::snapshotting_service::create_snapshot_for_script(
            Arc::new(self.pool.clone()),
            script_id
        ).await
        .map_err(|e| AppError::Internal(e))
    }
    
    async fn run_background_service(&self, interval: Duration) {
        crate::snapshotting_service::run_snapshotting_service(
            Arc::new(self.pool.clone()),
            interval
        ).await;
    }
}

#[cfg(test)]
pub mod test_services {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::Mutex;
    
    /// Mock service container for testing
    #[derive(Clone)]
    pub struct MockServiceContainer {
        database: MockDatabaseService,
        rate_limiter: MockRateLimitService,
        persistence_writer: MockPersistenceWriterService,
        snapshot_service: MockSnapshotService,
    }
    
    impl MockServiceContainer {
        pub fn new() -> Self {
            Self {
                database: MockDatabaseService::new(),
                rate_limiter: MockRateLimitService::new(),
                persistence_writer: MockPersistenceWriterService::new(),
                snapshot_service: MockSnapshotService::new(),
            }
        }
    }
    
    impl ServiceContainer for MockServiceContainer {
        type Database = MockDatabaseService;
        type RateLimiter = MockRateLimitService;
        type PersistenceWriter = MockPersistenceWriterService;
        type SnapshotService = MockSnapshotService;
        
        fn database(&self) -> &Self::Database {
            &self.database
        }
        
        fn rate_limiter(&self) -> &Self::RateLimiter {
            &self.rate_limiter
        }
        
        fn persistence_writer(&self) -> &Self::PersistenceWriter {
            &self.persistence_writer
        }
        
        fn snapshot_service(&self) -> &Self::SnapshotService {
            &self.snapshot_service
        }
    }
    
    /// Mock database service for testing
    #[derive(Clone)]
    pub struct MockDatabaseService {
        queries: Arc<Mutex<Vec<String>>>,
    }
    
    impl MockDatabaseService {
        pub fn new() -> Self {
            Self {
                queries: Arc::new(Mutex::new(Vec::new())),
            }
        }
        
        pub async fn get_executed_queries(&self) -> Vec<String> {
            self.queries.lock().await.clone()
        }
    }
    
    impl DatabaseService for MockDatabaseService {
        async fn get_pool(&self) -> Result<PgPool, AppError> {
            // Return a mock pool - in real tests this would be a test database
            Err(AppError::Internal(anyhow::anyhow!("Mock database - no real pool")))
        }
        
        async fn execute_query(&self, query: &str) -> Result<(), AppError> {
            self.queries.lock().await.push(query.to_string());
            Ok(())
        }
    }
    
    /// Mock rate limiter service for testing
    #[derive(Clone)]
    pub struct MockRateLimitService {
        rate_limits: Arc<Mutex<HashMap<String, u32>>>,
    }
    
    impl MockRateLimitService {
        pub fn new() -> Self {
            Self {
                rate_limits: Arc::new(Mutex::new(HashMap::new())),
            }
        }
        
        pub async fn set_rate_limit(&self, ip: &str, limit: u32) {
            self.rate_limits.lock().await.insert(ip.to_string(), limit);
        }
    }
    
    impl RateLimitService for MockRateLimitService {
        async fn check_rate_limit(&self, ip: &str) -> Result<bool, AppError> {
            let limits = self.rate_limits.lock().await;
            Ok(limits.get(ip).copied().unwrap_or(0) < 100)
        }
        
        async fn cleanup_old_data(&self) -> Result<(), AppError> {
            self.rate_limits.lock().await.clear();
            Ok(())
        }
    }
    
    /// Mock persistence writer service for testing
    #[derive(Clone)]
    pub struct MockPersistenceWriterService {
        events: Arc<Mutex<Vec<YjsPersistenceEvent>>>,
    }
    
    impl MockPersistenceWriterService {
        pub fn new() -> Self {
            Self {
                events: Arc::new(Mutex::new(Vec::new())),
            }
        }
        
        pub async fn get_events(&self) -> Vec<YjsPersistenceEvent> {
            self.events.lock().await.clone()
        }
    }
    
    impl PersistenceWriterService for MockPersistenceWriterService {
        async fn write_persistence_event(&self, event: YjsPersistenceEvent) -> Result<(), AppError> {
            self.events.lock().await.push(event);
            Ok(())
        }
        
        fn get_sender(&self) -> mpsc::Sender<YjsPersistenceEvent> {
            // Return a dummy sender for testing
            let (_tx, _rx) = mpsc::channel(1);
            _tx
        }
    }
    
    /// Mock snapshot service for testing
    #[derive(Clone)]
    pub struct MockSnapshotService {
        snapshots: Arc<Mutex<Vec<Uuid>>>,
    }
    
    impl MockSnapshotService {
        pub fn new() -> Self {
            Self {
                snapshots: Arc::new(Mutex::new(Vec::new())),
            }
        }
        
        pub async fn get_snapshots(&self) -> Vec<Uuid> {
            self.snapshots.lock().await.clone()
        }
    }
    
    impl SnapshotServiceTrait for MockSnapshotService {
        async fn create_snapshot(&self, script_id: Uuid) -> Result<(), AppError> {
            self.snapshots.lock().await.push(script_id);
            Ok(())
        }
        
        async fn run_background_service(&self, _interval: Duration) {
            // Mock implementation - do nothing
        }
    }
} 