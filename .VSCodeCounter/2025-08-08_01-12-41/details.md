# Details

Date : 2025-08-08 01:12:41

Directory /home/admins/projects/pessoa/backend

Total : 99 files,  9255 codes, 1682 comments, 1545 blanks, all 12482 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/.claude/settings.json](/backend/.claude/settings.json) | JSON with Comments | 7 | 0 | 1 | 8 |
| [backend/.claude/settings.local.json](/backend/.claude/settings.local.json) | JSON | 8 | 0 | 0 | 8 |
| [backend/.dockerignore](/backend/.dockerignore) | Ignore | 3 | 2 | 0 | 5 |
| [backend/check_blocks_schema.sql](/backend/check_blocks_schema.sql) | MS SQL | 4 | 0 | 0 | 4 |
| [backend/check_schema.sql](/backend/check_schema.sql) | MS SQL | 4 | 0 | 0 | 4 |
| [backend/list_users.sql](/backend/list_users.sql) | MS SQL | 1 | 0 | 0 | 1 |
| [backend/migrations/0001_create_tables.sql](/backend/migrations/0001_create_tables.sql) | MS SQL | 34 | 6 | 5 | 45 |
| [backend/migrations/20250101000001_add_username_role_to_users.sql](/backend/migrations/20250101000001_add_username_role_to_users.sql) | MS SQL | 2 | 7 | 3 | 12 |
| [backend/migrations/20250117000000_add_script_sharing.sql](/backend/migrations/20250117000000_add_script_sharing.sql) | MS SQL | 13 | 3 | 2 | 18 |
| [backend/migrations/20250118000000_add_thumbnail_to_scripts.sql](/backend/migrations/20250118000000_add_thumbnail_to_scripts.sql) | MS SQL | 2 | 2 | 1 | 5 |
| [backend/migrations/20250128000000_create_script_layouts_table.sql](/backend/migrations/20250128000000_create_script_layouts_table.sql) | MS SQL | 46 | 3 | 2 | 51 |
| [backend/migrations/20250131000000_add_page_number_to_blocks.sql](/backend/migrations/20250131000000_add_page_number_to_blocks.sql) | MS SQL | 7 | 5 | 3 | 15 |
| [backend/migrations/20250503174857_make_blocks_script_id_not_null.sql](/backend/migrations/20250503174857_make_blocks_script_id_not_null.sql) | MS SQL | 2 | 3 | 3 | 8 |
| [backend/migrations/20250506002947_add_dev_user.sql](/backend/migrations/20250506002947_add_dev_user.sql) | MS SQL | 8 | 2 | 1 | 11 |
| [backend/migrations/20250507000000_create_yjs_document_updates_table.sql](/backend/migrations/20250507000000_create_yjs_document_updates_table.sql) | MS SQL | 8 | 1 | 1 | 10 |
| [backend/migrations/20250507000001_create_script_snapshots_meta_table.sql](/backend/migrations/20250507000001_create_script_snapshots_meta_table.sql) | MS SQL | 5 | 1 | 0 | 6 |
| [backend/migrations/20250514160000_add_block_order_to_blocks.sql](/backend/migrations/20250514160000_add_block_order_to_blocks.sql) | MS SQL | 2 | 8 | 0 | 10 |
| [backend/migrations/20250514160500_add_metadata_to_blocks.sql](/backend/migrations/20250514160500_add_metadata_to_blocks.sql) | MS SQL | 2 | 1 | 0 | 3 |
| [backend/migrations/20250514161500_add_user_id_to_yjs_document_updates.sql](/backend/migrations/20250514161500_add_user_id_to_yjs_document_updates.sql) | MS SQL | 12 | 6 | 2 | 20 |
| [backend/migrations/20250710000000_add_content_snapshot_to_script_snapshots_meta.sql](/backend/migrations/20250710000000_add_content_snapshot_to_script_snapshots_meta.sql) | MS SQL | 7 | 4 | 3 | 14 |
| [backend/migrations/20250715000000_add_scene_fields_to_blocks.sql](/backend/migrations/20250715000000_add_scene_fields_to_blocks.sql) | MS SQL | 7 | 6 | 4 | 17 |
| [backend/security_verification.py](/backend/security_verification.py) | Python | 318 | 24 | 88 | 430 |
| [backend/src/analysis/errors.rs](/backend/src/analysis/errors.rs) | Rust | 8 | 1 | 1 | 10 |
| [backend/src/analysis/mod.rs](/backend/src/analysis/mod.rs) | Rust | 2 | 5 | 1 | 8 |
| [backend/src/analysis/structs.rs](/backend/src/analysis/structs.rs) | Rust | 446 | 31 | 37 | 514 |
| [backend/src/application/mod.rs](/backend/src/application/mod.rs) | Rust | 8 | 4 | 2 | 14 |
| [backend/src/application/page_break_application_service.rs](/backend/src/application/page_break_application_service.rs) | Rust | 237 | 45 | 43 | 325 |
| [backend/src/application/script_application_service.rs](/backend/src/application/script_application_service.rs) | Rust | 415 | 53 | 65 | 533 |
| [backend/src/application/script_sharing_application_service.rs](/backend/src/application/script_sharing_application_service.rs) | Rust | 206 | 30 | 34 | 270 |
| [backend/src/application/thumbnail_application_service.rs](/backend/src/application/thumbnail_application_service.rs) | Rust | 126 | 24 | 26 | 176 |
| [backend/src/auth/cookies.rs](/backend/src/auth/cookies.rs) | Rust | 88 | 16 | 21 | 125 |
| [backend/src/auth/core.rs](/backend/src/auth/core.rs) | Rust | 341 | 152 | 65 | 558 |
| [backend/src/auth/helpers.rs](/backend/src/auth/helpers.rs) | Rust | 42 | 3 | 5 | 50 |
| [backend/src/auth/mod.rs](/backend/src/auth/mod.rs) | Rust | 19 | 16 | 5 | 40 |
| [backend/src/auth/websocket_auth.rs](/backend/src/auth/websocket_auth.rs) | Rust | 34 | 4 | 8 | 46 |
| [backend/src/bin/json_to_db.rs](/backend/src/bin/json_to_db.rs) | Rust | 114 | 11 | 11 | 136 |
| [backend/src/bin/test_claude_session.rs](/backend/src/bin/test_claude_session.rs) | Rust | 79 | 8 | 15 | 102 |
| [backend/src/bin/test_json_to_db.rs](/backend/src/bin/test_json_to_db.rs) | Rust | 65 | 6 | 11 | 82 |
| [backend/src/bin/test_yjs_memory.rs](/backend/src/bin/test_yjs_memory.rs) | Rust | 58 | 5 | 12 | 75 |
| [backend/src/core/lib.rs](/backend/src/core/lib.rs) | Rust | 37 | 12 | 8 | 57 |
| [backend/src/core/mod.rs](/backend/src/core/mod.rs) | Rust | 6 | 15 | 2 | 23 |
| [backend/src/core/server.rs](/backend/src/core/server.rs) | Rust | 213 | 29 | 33 | 275 |
| [backend/src/core/service_manager.rs](/backend/src/core/service_manager.rs) | Rust | 246 | 50 | 47 | 343 |
| [backend/src/domain/collaboration_service.rs](/backend/src/domain/collaboration_service.rs) | Rust | 17 | 11 | 6 | 34 |
| [backend/src/domain/content_service.rs](/backend/src/domain/content_service.rs) | Rust | 13 | 9 | 5 | 27 |
| [backend/src/domain/mod.rs](/backend/src/domain/mod.rs) | Rust | 9 | 5 | 2 | 16 |
| [backend/src/domain/script_service.rs](/backend/src/domain/script_service.rs) | Rust | 287 | 63 | 75 | 425 |
| [backend/src/domain/snapshot/content_extractor_service.rs](/backend/src/domain/snapshot/content_extractor_service.rs) | Rust | 457 | 31 | 57 | 545 |
| [backend/src/domain/snapshot/html_parser_service.rs](/backend/src/domain/snapshot/html_parser_service.rs) | Rust | 198 | 29 | 41 | 268 |
| [backend/src/domain/snapshot/mod.rs](/backend/src/domain/snapshot/mod.rs) | Rust | 8 | 4 | 2 | 14 |
| [backend/src/domain/snapshot/snapshot_coordinator_service.rs](/backend/src/domain/snapshot/snapshot_coordinator_service.rs) | Rust | 280 | 23 | 55 | 358 |
| [backend/src/domain/snapshot/yjs_processor_service.rs](/backend/src/domain/snapshot/yjs_processor_service.rs) | Rust | 319 | 49 | 53 | 421 |
| [backend/src/domain/snapshot_service.rs](/backend/src/domain/snapshot_service.rs) | Rust | 17 | 11 | 6 | 34 |
| [backend/src/error/helpers.rs](/backend/src/error/helpers.rs) | Rust | 176 | 106 | 26 | 308 |
| [backend/src/error/mod.rs](/backend/src/error/mod.rs) | Rust | 11 | 16 | 3 | 30 |
| [backend/src/error/types.rs](/backend/src/error/types.rs) | Rust | 246 | 47 | 24 | 317 |
| [backend/src/external/mod.rs](/backend/src/external/mod.rs) | Rust | 0 | 12 | 1 | 13 |
| [backend/src/handlers/auth.rs](/backend/src/handlers/auth.rs) | Rust | 196 | 57 | 34 | 287 |
| [backend/src/handlers/claude_session_handler.rs](/backend/src/handlers/claude_session_handler.rs) | Rust | 85 | 0 | 12 | 97 |
| [backend/src/handlers/claude_websocket.rs](/backend/src/handlers/claude_websocket.rs) | Rust | 133 | 12 | 12 | 157 |
| [backend/src/handlers/mod.rs](/backend/src/handlers/mod.rs) | Rust | 6 | 4 | 1 | 11 |
| [backend/src/handlers/page_break_handlers.rs](/backend/src/handlers/page_break_handlers.rs) | Rust | 183 | 43 | 27 | 253 |
| [backend/src/handlers/script.rs](/backend/src/handlers/script.rs) | Rust | 184 | 41 | 34 | 259 |
| [backend/src/handlers/script_upload_handler.rs](/backend/src/handlers/script_upload_handler.rs) | Rust | 136 | 25 | 31 | 192 |
| [backend/src/infrastructure/config.rs](/backend/src/infrastructure/config.rs) | Rust | 85 | 16 | 5 | 106 |
| [backend/src/infrastructure/middleware.rs](/backend/src/infrastructure/middleware.rs) | Rust | 61 | 9 | 10 | 80 |
| [backend/src/infrastructure/mod.rs](/backend/src/infrastructure/mod.rs) | Rust | 4 | 16 | 2 | 22 |
| [backend/src/lib.rs](/backend/src/lib.rs) | Rust | 15 | 16 | 3 | 34 |
| [backend/src/main.rs](/backend/src/main.rs) | Rust | 78 | 48 | 21 | 147 |
| [backend/src/models/block.rs](/backend/src/models/block.rs) | Rust | 17 | 14 | 1 | 32 |
| [backend/src/models/edit.rs](/backend/src/models/edit.rs) | Rust | 12 | 9 | 1 | 22 |
| [backend/src/models/mod.rs](/backend/src/models/mod.rs) | Rust | 8 | 4 | 0 | 12 |
| [backend/src/models/script.rs](/backend/src/models/script.rs) | Rust | 14 | 10 | 1 | 25 |
| [backend/src/models/script_layout.rs](/backend/src/models/script_layout.rs) | Rust | 31 | 16 | 3 | 50 |
| [backend/src/models/script_share.rs](/backend/src/models/script_share.rs) | Rust | 37 | 14 | 5 | 56 |
| [backend/src/models/snapshot_meta.rs](/backend/src/models/snapshot_meta.rs) | Rust | 10 | 0 | 1 | 11 |
| [backend/src/models/user.rs](/backend/src/models/user.rs) | Rust | 13 | 9 | 1 | 23 |
| [backend/src/models/yjs_update.rs](/backend/src/models/yjs_update.rs) | Rust | 12 | 0 | 1 | 13 |
| [backend/src/networking/mod.rs](/backend/src/networking/mod.rs) | Rust | 5 | 16 | 2 | 23 |
| [backend/src/networking/websocket.rs](/backend/src/networking/websocket.rs) | Rust | 363 | 84 | 63 | 510 |
| [backend/src/repositories/block_repository.rs](/backend/src/repositories/block_repository.rs) | Rust | 81 | 9 | 15 | 105 |
| [backend/src/repositories/mod.rs](/backend/src/repositories/mod.rs) | Rust | 10 | 5 | 2 | 17 |
| [backend/src/repositories/script_repository.rs](/backend/src/repositories/script_repository.rs) | Rust | 169 | 13 | 35 | 217 |
| [backend/src/repositories/snapshot_repository.rs](/backend/src/repositories/snapshot_repository.rs) | Rust | 197 | 17 | 39 | 253 |
| [backend/src/repositories/user_repository.rs](/backend/src/repositories/user_repository.rs) | Rust | 151 | 12 | 31 | 194 |
| [backend/src/repositories/yjs_update_repository.rs](/backend/src/repositories/yjs_update_repository.rs) | Rust | 213 | 14 | 39 | 266 |
| [backend/src/services/async_db_writer.rs](/backend/src/services/async_db_writer.rs) | Rust | 64 | 9 | 7 | 80 |
| [backend/src/services/claude_session_monitor.rs](/backend/src/services/claude_session_monitor.rs) | Rust | 59 | 1 | 11 | 71 |
| [backend/src/services/claude_session_service.rs](/backend/src/services/claude_session_service.rs) | Rust | 339 | 32 | 49 | 420 |
| [backend/src/services/json_to_db_service.rs](/backend/src/services/json_to_db_service.rs) | Rust | 321 | 31 | 36 | 388 |
| [backend/src/services/mod.rs](/backend/src/services/mod.rs) | Rust | 12 | 17 | 2 | 31 |
| [backend/src/services/persistence_event.rs](/backend/src/services/persistence_event.rs) | Rust | 9 | 1 | 1 | 11 |
| [backend/src/services/prompt.md](/backend/src/services/prompt.md) | Markdown | 214 | 0 | 34 | 248 |
| [backend/src/services/snapshotting_service_v2.rs](/backend/src/services/snapshotting_service_v2.rs) | Rust | 71 | 5 | 17 | 93 |
| [backend/src/services/thumbnail.rs](/backend/src/services/thumbnail.rs) | Rust | 204 | 21 | 25 | 250 |
| [backend/src/utils/mod.rs](/backend/src/utils/mod.rs) | Rust | 1 | 7 | 2 | 10 |
| [backend/src/utils/test_yjs.rs](/backend/src/utils/test_yjs.rs) | Rust | 3 | 3 | 1 | 7 |
| [backend/test_multipage.json](/backend/test_multipage.json) | JSON | 109 | 0 | 0 | 109 |
| [backend/verify_insert.sql](/backend/verify_insert.sql) | MS SQL | 10 | 2 | 1 | 13 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)