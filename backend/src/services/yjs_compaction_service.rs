use anyhow::anyhow;
use anyhow::Result;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use yrs::updates::encoder::Encode;
use yrs::{
    updates::decoder::Decode, Doc, GetString, Options, ReadTxn, StateVector, Transact, Update,
    WriteTxn,
};

/// Service responsible for compacting YJS updates into base states
pub struct CompactionService {
    pool: Arc<PgPool>,
    max_updates_before_compact: usize,
    max_age_before_compact: Duration,
}

impl CompactionService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self {
            pool,
            max_updates_before_compact: 500,
            max_age_before_compact: Duration::from_secs(1800), // 30 minutes
        }
    }

    /// Main service loop - runs every 5 minutes
    pub async fn run(self: Arc<Self>) {
        info!("🚀 YJS Compaction Service started - running every 5 minutes");
        let mut interval = interval(Duration::from_secs(300));

        loop {
            interval.tick().await;
            debug!("Running compaction check...");

            match self.find_scripts_needing_compaction().await {
                Ok(scripts) => {
                    if scripts.is_empty() {
                        debug!("No scripts need compaction");
                    } else {
                        info!("Found {} scripts needing compaction", scripts.len());
                        for script_id in scripts {
                            if let Err(e) = self.compact_script(script_id).await {
                                error!("Failed to compact script {}: {}", script_id, e);
                            }
                        }
                    }
                }
                Err(e) => error!("Failed to find scripts for compaction: {}", e),
            }
        }
    }

    async fn find_scripts_needing_compaction(&self) -> Result<Vec<Uuid>> {
        let scripts = sqlx::query!(
            r#"
            SELECT DISTINCT r.script_id
            FROM yjs_recent_updates r
            LEFT JOIN yjs_base_states b ON r.script_id = b.script_id
            WHERE r.is_compacted = false
            GROUP BY r.script_id, b.compacted_at
            HAVING 
                COUNT(*) > $1  -- Too many updates
                OR MIN(r.created_at) < NOW() - INTERVAL '30 minutes'  -- Old updates
                OR b.compacted_at IS NULL  -- Never compacted
                OR b.compacted_at < NOW() - INTERVAL '30 minutes'  -- Stale base
            LIMIT 10  -- Process max 10 scripts at a time
            "#,
            self.max_updates_before_compact as i64
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        Ok(scripts.into_iter().map(|r| r.script_id).collect())
    }

    async fn compact_script(&self, script_id: Uuid) -> Result<()> {
        let start = std::time::Instant::now();
        info!("Starting compaction for script {}", script_id);

        // Start transaction
        let mut tx = self.pool.begin().await?;

        // 1. Load current base state
        let base_state = sqlx::query!(
            "SELECT base_state, state_vector FROM yjs_base_states WHERE script_id = $1",
            script_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        // 2. Load uncompacted updates
        let updates = sqlx::query!(
            r#"
            SELECT id, update_data 
            FROM yjs_recent_updates 
            WHERE script_id = $1 AND is_compacted = false
            ORDER BY id ASC
            "#,
            script_id
        )
        .fetch_all(&mut *tx)
        .await?;

        if updates.is_empty() {
            debug!("No updates to compact for script {}", script_id);
            return Ok(());
        }

        let update_count = updates.len();
        let size_before: i32 = updates.iter().map(|u| u.update_data.len() as i32).sum();

        // 3. Create YJS document and apply base + updates
        let doc = Doc::with_options(Options {
            skip_gc: false, // Enable garbage collection
            ..Default::default()
        });

        // Bootstrap the document with required fragments (same as old system)
        {
            let mut txn = doc.transact_mut();
            for name in ["default", "content", "prosemirror"] {
                txn.get_or_insert_xml_fragment(name);
                txn.get_or_insert_text(name);
            }
        }

        // Apply base state if exists
        if let Some(base) = base_state {
            if !base.base_state.is_empty() {
                match Update::decode_v1(&base.base_state) {
                    Ok(update) => {
                        doc.transact_mut().apply_update(update);
                        debug!("Applied base state ({} bytes)", base.base_state.len());
                    }
                    Err(e) => {
                        error!("Failed to decode base state: {}", e);
                        // Continue anyway - we'll rebuild from updates
                    }
                }
            }
        }

        // Apply new updates
        let mut last_update_id = 0i64;
        let mut applied_count = 0;
        for update in &updates {
            match Update::decode_v1(&update.update_data) {
                Ok(yjs_update) => {
                    doc.transact_mut().apply_update(yjs_update);
                    applied_count += 1;
                }
                Err(e) => {
                    warn!("Failed to decode update {}: {} (skipping)", update.id, e);
                    // Skip bad updates but continue
                }
            }
            last_update_id = update.id;
        }

        debug!("Applied {}/{} updates", applied_count, update_count);

        // 4. Generate new compacted state
        let new_base_state = doc
            .transact()
            .encode_state_as_update_v1(&StateVector::default());
        let state_vector = doc.transact().state_vector().encode_v1();
        let size_after = new_base_state.len() as i32;

        // 5. Save new base state
        sqlx::query!(
            r#"
            INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id, update_count, document_size)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (script_id) 
            DO UPDATE SET 
                base_state = EXCLUDED.base_state,
                state_vector = EXCLUDED.state_vector,
                last_compacted_update_id = EXCLUDED.last_compacted_update_id,
                update_count = yjs_base_states.update_count + EXCLUDED.update_count,
                document_size = EXCLUDED.document_size,
                compacted_at = NOW()
            "#,
            script_id,
            new_base_state.as_slice(),
            state_vector.as_slice(),
            last_update_id,
            update_count as i32,
            size_after
        )
        .execute(&mut *tx)
        .await?;

        // 6. Mark updates as compacted (soft delete)
        sqlx::query!(
            "UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1 AND id <= $2",
            script_id,
            last_update_id
        )
        .execute(&mut *tx)
        .await?;

        // 7. Log compaction
        let duration_ms = start.elapsed().as_millis() as i32;
        sqlx::query!(
            r#"
            INSERT INTO yjs_compaction_log (script_id, updates_compacted, size_before, size_after, duration_ms)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            script_id,
            update_count as i32,
            size_before,
            size_after,
            duration_ms
        )
        .execute(&mut *tx)
        .await?;

        // Commit transaction
        tx.commit().await?;

        let compression_ratio = if size_before > 0 {
            ((1.0 - (size_after as f64 / size_before as f64)) * 100.0) as i32
        } else {
            0
        };

        info!(
            "✅ Compacted script {} - {} updates ({} bytes) → {} bytes ({}% reduction) in {}ms",
            script_id, update_count, size_before, size_after, compression_ratio, duration_ms
        );

        Ok(())
    }

    /// Check health and alert if there are issues
    pub async fn check_health(&self) -> Result<()> {
        // Alert if too many pending updates
        let unhealthy = sqlx::query!(
            r#"
            SELECT script_id, COUNT(*) as count
            FROM yjs_recent_updates
            WHERE is_compacted = false
            GROUP BY script_id
            HAVING COUNT(*) > 5000
            "#
        )
        .fetch_all(self.pool.as_ref())
        .await?;

        for script in unhealthy {
            if let Some(count) = script.count {
                error!(
                    "⚠️ Script {} has {} uncompacted updates - needs urgent compaction!",
                    script.script_id, count
                );
            }
        }

        Ok(())
    }
}

/// Public function to load a document efficiently using the new compacted system
pub async fn load_document(pool: &PgPool, script_id: Uuid) -> Result<Doc> {
    debug!("Loading document for script {}", script_id);

    // 1. Load base state
    let base = sqlx::query!(
        "SELECT base_state FROM yjs_base_states WHERE script_id = $1",
        script_id
    )
    .fetch_optional(pool)
    .await?;

    // 2. Load recent uncompacted updates
    let recent_updates = sqlx::query!(
        r#"
        SELECT update_data 
        FROM yjs_recent_updates 
        WHERE script_id = $1 AND is_compacted = false
        ORDER BY id ASC
        "#,
        script_id
    )
    .fetch_all(pool)
    .await?;

    // 3. Create document without bootstrapping first
    let doc = Doc::with_options(Options {
        skip_gc: false, // Enable GC for proper state management
        ..Default::default()
    });

    // 4. Apply base if exists FIRST before bootstrapping
    let has_base_state = if let Some(base) = base {
        if !base.base_state.is_empty() {
            info!(
                "Found base state for script {} with {} bytes",
                script_id,
                base.base_state.len()
            );
            match Update::decode_v1(&base.base_state) {
                Ok(update) => {
                    doc.transact_mut().apply_update(update);
                    info!(
                        "Successfully loaded base state ({} bytes) for script {}",
                        base.base_state.len(),
                        script_id
                    );
                    true
                }
                Err(e) => {
                    error!(
                        "Failed to decode base state for script {}: {}",
                        script_id, e
                    );
                    false
                }
            }
        } else {
            info!("Base state exists but is empty for script {}", script_id);
            false
        }
    } else {
        info!("No base state found for script {}", script_id);
        false
    };

    // 5. Bootstrap with required fragments ONLY if no base state was loaded
    if !has_base_state {
        info!("Bootstrapping empty document for script {}", script_id);
        let mut txn = doc.transact_mut();
        for name in ["default", "content", "prosemirror", "xmlFragment"] {
            txn.get_or_insert_xml_fragment(name);
            txn.get_or_insert_text(name);
        }
        txn.get_or_insert_map("metadata");
    } else {
        // Debug: log what we have after loading base state
        let txn = doc.transact();
        info!(
            "After loading base state for {}: has_default={}, has_xmlFragment={}, has_content={}",
            script_id,
            txn.get_xml_fragment("default").is_some(),
            txn.get_xml_fragment("xmlFragment").is_some(),
            txn.get_xml_fragment("content").is_some()
        );
    }

    // 6. Apply recent updates
    let mut applied = 0;
    for update in recent_updates {
        match Update::decode_v1(&update.update_data) {
            Ok(yjs_update) => {
                doc.transact_mut().apply_update(yjs_update);
                applied += 1;
            }
            Err(e) => {
                // Fallback: some legacy rows may contain a full y-protocol Sync frame
                // Try to decode as yrs::sync::Message and extract the inner Update payload
                warn!("Failed to decode recent update via Update::decode_v1: {} (attempting sync fallback)", e);
                use yrs::encoding::read::Cursor as YrsCursor;
                use yrs::sync::{Message as SyncEnvelope, SyncMessage as SyncInner};
                use yrs::updates::decoder::{Decode as _, DecoderV1};

                let mut dec = DecoderV1::new(YrsCursor::new(&update.update_data));
                match <SyncEnvelope as yrs::updates::decoder::Decode>::decode(&mut dec) {
                    Ok(SyncEnvelope::Sync(inner)) => {
                        let bytes_opt = match inner {
                            SyncInner::Update(bytes) => Some(bytes),
                            SyncInner::SyncStep2(bytes) => Some(bytes),
                            _ => None,
                        };
                        if let Some(bytes) = bytes_opt {
                            match Update::decode_v1(&bytes) {
                                Ok(yjs_update) => {
                                    doc.transact_mut().apply_update(yjs_update);
                                    applied += 1;
                                    debug!(
                                        "Applied legacy sync-encoded update ({} bytes)",
                                        bytes.len()
                                    );
                                }
                                Err(e2) => {
                                    warn!("Failed to decode inner Update payload from sync frame: {} (skipping)", e2);
                                }
                            }
                        } else {
                            warn!("Sync frame was not an Update/SyncStep2 payload; skipping");
                        }
                    }
                    Ok(_other) => {
                        warn!("Decoded a non-Sync message variant; skipping");
                    }
                    Err(e_sync) => {
                        warn!("Fallback sync decode failed: {} (skipping update)", e_sync);
                    }
                }
            }
        }
    }

    debug!("Document loaded with {} recent updates applied", applied);
    Ok(doc)
}

/// Compact base state immediately by folding all recent updates into yjs_base_states
pub async fn compact_now(pool: &PgPool, script_id: Uuid) -> Result<()> {
    use yrs::updates::encoder::Encode;
    use yrs::Transact;

    // Load current document (base + recent updates)
    let doc = load_document(pool, script_id).await?;
    let new_base = doc
        .transact()
        .encode_state_as_update_v1(&yrs::StateVector::default());
    let state_vector = doc.transact().state_vector().encode_v1();

    // Persist new base and roll up metadata
    let last_update_id: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(id), 0) FROM yjs_recent_updates WHERE script_id = $1",
    )
    .bind(script_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let update_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM yjs_recent_updates WHERE script_id = $1")
            .bind(script_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let size_after = new_base.len() as i32;
    let update_count_i32 = (update_count as i32).max(0);

    sqlx::query(
        r#"
        INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id, update_count, document_size)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (script_id)
        DO UPDATE SET 
            base_state = EXCLUDED.base_state,
            state_vector = EXCLUDED.state_vector,
            last_compacted_update_id = EXCLUDED.last_compacted_update_id,
            update_count = yjs_base_states.update_count + EXCLUDED.update_count,
            document_size = EXCLUDED.document_size,
            compacted_at = NOW()
        "#
    )
    .bind(script_id)
    .bind(new_base.as_slice())
    .bind(state_vector.as_slice())
    .bind(last_update_id)
    .bind(update_count_i32)
    .bind(size_after)
    .execute(pool)
    .await?;

    // Mark updates as compacted
    sqlx::query(
        "UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1 AND is_compacted = false"
    )
    .bind(script_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Compute current state vector bytes for a script's document (base + recent updates)
pub async fn load_state_vector_bytes(pool: &PgPool, script_id: Uuid) -> Result<Vec<u8>> {
    let doc = load_document(pool, script_id).await?;
    let sv = doc.transact().state_vector().encode_v1();
    Ok(sv)
}

/// Compute a diff update (as update bytes) against a client-provided state vector
pub async fn compute_diff_update(
    pool: &PgPool,
    script_id: Uuid,
    client_state_vector_v1: &[u8],
) -> Result<Vec<u8>> {
    use yrs::updates::decoder::Decode;
    let doc = load_document(pool, script_id).await?;
    // Decode client SV
    let client_sv = yrs::StateVector::decode_v1(client_state_vector_v1)?;
    let diff = doc.transact().encode_state_as_update_v1(&client_sv);
    Ok(diff)
}

/// Extract text content from YJS document for preview/search
pub fn extract_text_content(doc: &Doc) -> String {
    let txn = doc.transact();

    // Try to get content from the "content" fragment first
    if let Some(content) = txn.get_xml_fragment("content") {
        return content.get_string(&txn);
    }

    // Fallback to "prosemirror" fragment
    if let Some(prosemirror) = txn.get_xml_fragment("prosemirror") {
        return prosemirror.get_string(&txn);
    }

    // Fallback to "default" fragment
    if let Some(default) = txn.get_xml_fragment("default") {
        return default.get_string(&txn);
    }

    String::new()
}

/// Cleanup old compacted updates (run periodically)
pub async fn cleanup_old_updates(pool: &PgPool, days_to_keep: i64) -> Result<()> {
    let deleted = sqlx::query!(
        r#"
        DELETE FROM yjs_recent_updates 
        WHERE is_compacted = true 
        AND created_at < NOW() - ($1 * INTERVAL '1 day')
        "#,
        days_to_keep as f64
    )
    .execute(pool)
    .await?;

    if deleted.rows_affected() > 0 {
        info!(
            "Cleaned up {} old compacted updates",
            deleted.rows_affected()
        );
    }

    Ok(())
}

/// Migrate a script's Yjs document by rebuilding a clean TipTap-compatible
/// structure from legacy plaintext markers. This removes hidden legacy nodes
/// (e.g., cueBlock) and produces visible content in the `default` fragment.
///
/// Strategy:
/// - Extract text via `extract_text_content` (prefers `content`, then `prosemirror`, then `default`).
/// - Parse simple markers emitted by the importer: [PAGE] N, [SCENE] Title, and
///   dialogue blocks in the form `Speaker: line1\nline2...`.
/// - Build a fresh Y.Doc with pageIndicator, sceneBlock, dialogueBlock, and paragraph nodes.
/// - Overwrite `yjs_base_states` for the script and mark recent updates compacted.
pub async fn migrate_legacy_to_structured(pool: &PgPool, script_id: Uuid) -> Result<(i32, i64)> {
    use yrs::updates::encoder::Encode;
    use yrs::{Transact, WriteTxn};
    use yrs::{XmlElementPrelim, XmlFragment as _, XmlTextPrelim};

    // Load current document (base + updates)
    let doc = load_document(pool, script_id).await?;
    let legacy_text = extract_text_content(&doc);
    if legacy_text.trim().is_empty() {
        return Err(anyhow!("Legacy text content is empty; nothing to migrate"));
    }

    // Build a fresh structured document
    let new_doc = Doc::with_options(Options::default());
    {
        let mut txn = new_doc.transact_mut();
        let frag = txn.get_or_insert_xml_fragment("default");
        txn.get_or_insert_text("prosemirror");
        txn.get_or_insert_map("metadata");

        // Split into blocks by blank line
        for raw_block in legacy_text.split("\n\n") {
            let block = raw_block.trim();
            if block.is_empty() {
                continue;
            }

            // [PAGE] N
            if let Some(rest) = block.strip_prefix("[PAGE] ") {
                let n = rest.split_whitespace().next().unwrap_or("");
                let page_el = XmlElementPrelim::empty("pageIndicator");
                let page_ref = frag.push_back(&mut txn, page_el);
                page_ref.push_back(&mut txn, XmlTextPrelim::new(format!("Page {}", n)));
                continue;
            }

            // [SCENE] Title
            if let Some(title) = block.strip_prefix("[SCENE] ") {
                let scene_el = XmlElementPrelim::empty("sceneBlock");
                let scene_ref = frag.push_back(&mut txn, scene_el);
                let t = title.trim();
                scene_ref.push_back(
                    &mut txn,
                    XmlTextPrelim::new(if t.is_empty() {
                        "Untitled Scene".to_string()
                    } else {
                        t.to_string()
                    }),
                );
                continue;
            }

            // Dialogue: First line "Speaker: text", subsequent non-empty lines are more paragraphs
            let mut lines = block.lines();
            if let Some(first) = lines.next() {
                if let Some((speaker, first_text)) = first.split_once(':') {
                    let dlg = frag.push_back(&mut txn, XmlElementPrelim::empty("dialogueBlock"));
                    let sp = dlg.push_back(&mut txn, XmlElementPrelim::empty("speaker"));
                    let name = speaker.trim();
                    if !name.is_empty() {
                        sp.push_back(&mut txn, XmlTextPrelim::new(name.to_string()));
                    }
                    let dtext = dlg.push_back(&mut txn, XmlElementPrelim::empty("dialogueText"));
                    let t0 = first_text.trim();
                    if !t0.is_empty() {
                        let p = dtext.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                        p.push_back(&mut txn, XmlTextPrelim::new(t0.to_string()));
                    }
                    for l in lines {
                        let lt = l.trim();
                        if lt.is_empty() {
                            continue;
                        }
                        let p = dtext.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
                        p.push_back(&mut txn, XmlTextPrelim::new(lt.to_string()));
                    }
                    continue;
                }
            }

            // Plain paragraph
            let p = frag.push_back(&mut txn, XmlElementPrelim::empty("paragraph"));
            p.push_back(&mut txn, XmlTextPrelim::new(block.to_string()));
        }
    }

    // Persist as new base state
    let new_base = new_doc
        .transact()
        .encode_state_as_update_v1(&StateVector::default());
    let state_vector = new_doc.transact().state_vector().encode_v1();

    // Figure out current last update id for bookkeeping
    let last_update_id: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(id), 0) FROM yjs_recent_updates WHERE script_id = $1",
    )
    .bind(script_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO yjs_base_states (script_id, base_state, state_vector, last_compacted_update_id, update_count, document_size)
        VALUES ($1, $2, $3, $4, 0, $5)
        ON CONFLICT (script_id)
        DO UPDATE SET 
            base_state = EXCLUDED.base_state,
            state_vector = EXCLUDED.state_vector,
            last_compacted_update_id = EXCLUDED.last_compacted_update_id,
            document_size = EXCLUDED.document_size,
            compacted_at = NOW()
        "#
    )
    .bind(script_id)
    .bind(new_base.as_slice())
    .bind(state_vector.as_slice())
    .bind(last_update_id)
    .bind(new_base.len() as i32)
    .execute(pool)
    .await?;

    // Mark all recent updates compacted (we fully replaced base)
    let updated = sqlx::query(
        "UPDATE yjs_recent_updates SET is_compacted = true WHERE script_id = $1 AND is_compacted = false"
    )
    .bind(script_id)
    .execute(pool)
    .await?;

    Ok((new_base.len() as i32, updated.rows_affected() as i64))
}
