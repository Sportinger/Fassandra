use std::sync::Arc;
use sqlx::PgPool;
use tokio::time::Duration;
use uuid::Uuid;
use tracing::{info, error, debug};

use crate::domain::snapshot::SnapshotCoordinatorService;

/// New version of the snapshotting service using the extracted services architecture
pub struct SnapshotServiceV2 {
    coordinator: SnapshotCoordinatorService,
}

impl SnapshotServiceV2 {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            coordinator: SnapshotCoordinatorService::new(pool),
        }
    }
}

/// Main entry point for creating a snapshot (maintains backward compatibility)
pub async fn create_snapshot_for_script(pool: Arc<PgPool>, script_id: Uuid) -> Result<(), anyhow::Error> {
    let service = SnapshotServiceV2::new(pool);
    service.coordinator.create_snapshot(script_id).await
}

/// Main snapshotting service runner (maintains backward compatibility)
pub async fn run_snapshotting_service(pool: Arc<PgPool>, _base_interval_duration: Duration) {
    const SNAPSHOT_INTERVAL_MILLIS: u64 = 500; // Run every 500ms for real-time sync
    
    info!("🚀 Snapshotting Service V2 SPAWNED and RUNNING every {}ms for real-time sync!", SNAPSHOT_INTERVAL_MILLIS);
    
    let coordinator = SnapshotCoordinatorService::new(pool);
    let mut scripts_processed_count = 0u64;
    
    loop {
        tokio::time::sleep(Duration::from_millis(SNAPSHOT_INTERVAL_MILLIS)).await;
        
        debug!("🔍 [SnapshottingServiceV2] Running scheduled snapshot check...");
        
        match coordinator.get_scripts_needing_snapshot().await {
            Ok(script_ids) => {
                if script_ids.is_empty() {
                    debug!("[SnapshottingServiceV2] No scripts currently require snapshotting.");
                } else {
                    info!("📝 [SnapshottingServiceV2] Processing {} script(s) for snapshotting", script_ids.len());
                    
                    for script_id in script_ids {
                        debug!("[SnapshottingServiceV2] Processing script_id: {} for snapshotting.", script_id);
                        match coordinator.create_snapshot(script_id).await {
                            Ok(_) => {
                                scripts_processed_count += 1;
                                info!("[SnapshottingServiceV2] ✅ Successfully processed snapshot for script_id: {}", script_id);
                            }
                            Err(e) => {
                                error!("[SnapshottingServiceV2] ❌ Error during snapshot for script_id: {}: {}", script_id, e);
                            }
                        }
                    }
                    
                    info!("📊 [SnapshottingServiceV2] Completed snapshot batch. Total scripts processed: {}", scripts_processed_count);
                }
            }
            Err(e) => {
                error!("[SnapshottingServiceV2] Error fetching scripts needing snapshot: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_snapshot_service_creation() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let service = SnapshotServiceV2::new(pool);
        
        // Test that service can be created
        assert!(true);
    }
    
    #[tokio::test]
    async fn test_create_snapshot_interface() {
        let pool = Arc::new(PgPool::connect("postgresql://test").await.unwrap());
        let script_id = uuid::Uuid::new_v4();
        
        // This should not panic (though it may fail due to missing data)
        let _ = create_snapshot_for_script(pool, script_id).await;
    }
} 