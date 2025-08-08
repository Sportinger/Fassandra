# Diff Details

Date : 2025-08-08 01:13:13

Directory /home/admins/projects/pessoa/frontend

Total : 242 files,  7686 codes, 627 comments, 1386 blanks, all 9699 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/.claude/settings.json](/backend/.claude/settings.json) | JSON with Comments | -7 | 0 | -1 | -8 |
| [backend/.claude/settings.local.json](/backend/.claude/settings.local.json) | JSON | -8 | 0 | 0 | -8 |
| [backend/.dockerignore](/backend/.dockerignore) | Ignore | -3 | -2 | 0 | -5 |
| [backend/check_blocks_schema.sql](/backend/check_blocks_schema.sql) | MS SQL | -4 | 0 | 0 | -4 |
| [backend/check_schema.sql](/backend/check_schema.sql) | MS SQL | -4 | 0 | 0 | -4 |
| [backend/list_users.sql](/backend/list_users.sql) | MS SQL | -1 | 0 | 0 | -1 |
| [backend/migrations/0001_create_tables.sql](/backend/migrations/0001_create_tables.sql) | MS SQL | -34 | -6 | -5 | -45 |
| [backend/migrations/20250101000001_add_username_role_to_users.sql](/backend/migrations/20250101000001_add_username_role_to_users.sql) | MS SQL | -2 | -7 | -3 | -12 |
| [backend/migrations/20250117000000_add_script_sharing.sql](/backend/migrations/20250117000000_add_script_sharing.sql) | MS SQL | -13 | -3 | -2 | -18 |
| [backend/migrations/20250118000000_add_thumbnail_to_scripts.sql](/backend/migrations/20250118000000_add_thumbnail_to_scripts.sql) | MS SQL | -2 | -2 | -1 | -5 |
| [backend/migrations/20250128000000_create_script_layouts_table.sql](/backend/migrations/20250128000000_create_script_layouts_table.sql) | MS SQL | -46 | -3 | -2 | -51 |
| [backend/migrations/20250131000000_add_page_number_to_blocks.sql](/backend/migrations/20250131000000_add_page_number_to_blocks.sql) | MS SQL | -7 | -5 | -3 | -15 |
| [backend/migrations/20250503174857_make_blocks_script_id_not_null.sql](/backend/migrations/20250503174857_make_blocks_script_id_not_null.sql) | MS SQL | -2 | -3 | -3 | -8 |
| [backend/migrations/20250506002947_add_dev_user.sql](/backend/migrations/20250506002947_add_dev_user.sql) | MS SQL | -8 | -2 | -1 | -11 |
| [backend/migrations/20250507000000_create_yjs_document_updates_table.sql](/backend/migrations/20250507000000_create_yjs_document_updates_table.sql) | MS SQL | -8 | -1 | -1 | -10 |
| [backend/migrations/20250507000001_create_script_snapshots_meta_table.sql](/backend/migrations/20250507000001_create_script_snapshots_meta_table.sql) | MS SQL | -5 | -1 | 0 | -6 |
| [backend/migrations/20250514160000_add_block_order_to_blocks.sql](/backend/migrations/20250514160000_add_block_order_to_blocks.sql) | MS SQL | -2 | -8 | 0 | -10 |
| [backend/migrations/20250514160500_add_metadata_to_blocks.sql](/backend/migrations/20250514160500_add_metadata_to_blocks.sql) | MS SQL | -2 | -1 | 0 | -3 |
| [backend/migrations/20250514161500_add_user_id_to_yjs_document_updates.sql](/backend/migrations/20250514161500_add_user_id_to_yjs_document_updates.sql) | MS SQL | -12 | -6 | -2 | -20 |
| [backend/migrations/20250710000000_add_content_snapshot_to_script_snapshots_meta.sql](/backend/migrations/20250710000000_add_content_snapshot_to_script_snapshots_meta.sql) | MS SQL | -7 | -4 | -3 | -14 |
| [backend/migrations/20250715000000_add_scene_fields_to_blocks.sql](/backend/migrations/20250715000000_add_scene_fields_to_blocks.sql) | MS SQL | -7 | -6 | -4 | -17 |
| [backend/security_verification.py](/backend/security_verification.py) | Python | -318 | -24 | -88 | -430 |
| [backend/src/analysis/errors.rs](/backend/src/analysis/errors.rs) | Rust | -8 | -1 | -1 | -10 |
| [backend/src/analysis/mod.rs](/backend/src/analysis/mod.rs) | Rust | -2 | -5 | -1 | -8 |
| [backend/src/analysis/structs.rs](/backend/src/analysis/structs.rs) | Rust | -446 | -31 | -37 | -514 |
| [backend/src/application/mod.rs](/backend/src/application/mod.rs) | Rust | -8 | -4 | -2 | -14 |
| [backend/src/application/page_break_application_service.rs](/backend/src/application/page_break_application_service.rs) | Rust | -237 | -45 | -43 | -325 |
| [backend/src/application/script_application_service.rs](/backend/src/application/script_application_service.rs) | Rust | -415 | -53 | -65 | -533 |
| [backend/src/application/script_sharing_application_service.rs](/backend/src/application/script_sharing_application_service.rs) | Rust | -206 | -30 | -34 | -270 |
| [backend/src/application/thumbnail_application_service.rs](/backend/src/application/thumbnail_application_service.rs) | Rust | -126 | -24 | -26 | -176 |
| [backend/src/auth/cookies.rs](/backend/src/auth/cookies.rs) | Rust | -88 | -16 | -21 | -125 |
| [backend/src/auth/core.rs](/backend/src/auth/core.rs) | Rust | -341 | -152 | -65 | -558 |
| [backend/src/auth/helpers.rs](/backend/src/auth/helpers.rs) | Rust | -42 | -3 | -5 | -50 |
| [backend/src/auth/mod.rs](/backend/src/auth/mod.rs) | Rust | -19 | -16 | -5 | -40 |
| [backend/src/auth/websocket_auth.rs](/backend/src/auth/websocket_auth.rs) | Rust | -34 | -4 | -8 | -46 |
| [backend/src/bin/json_to_db.rs](/backend/src/bin/json_to_db.rs) | Rust | -114 | -11 | -11 | -136 |
| [backend/src/bin/test_claude_session.rs](/backend/src/bin/test_claude_session.rs) | Rust | -79 | -8 | -15 | -102 |
| [backend/src/bin/test_json_to_db.rs](/backend/src/bin/test_json_to_db.rs) | Rust | -65 | -6 | -11 | -82 |
| [backend/src/bin/test_yjs_memory.rs](/backend/src/bin/test_yjs_memory.rs) | Rust | -58 | -5 | -12 | -75 |
| [backend/src/core/lib.rs](/backend/src/core/lib.rs) | Rust | -37 | -12 | -8 | -57 |
| [backend/src/core/mod.rs](/backend/src/core/mod.rs) | Rust | -6 | -15 | -2 | -23 |
| [backend/src/core/server.rs](/backend/src/core/server.rs) | Rust | -213 | -29 | -33 | -275 |
| [backend/src/core/service_manager.rs](/backend/src/core/service_manager.rs) | Rust | -246 | -50 | -47 | -343 |
| [backend/src/domain/collaboration_service.rs](/backend/src/domain/collaboration_service.rs) | Rust | -17 | -11 | -6 | -34 |
| [backend/src/domain/content_service.rs](/backend/src/domain/content_service.rs) | Rust | -13 | -9 | -5 | -27 |
| [backend/src/domain/mod.rs](/backend/src/domain/mod.rs) | Rust | -9 | -5 | -2 | -16 |
| [backend/src/domain/script_service.rs](/backend/src/domain/script_service.rs) | Rust | -287 | -63 | -75 | -425 |
| [backend/src/domain/snapshot/content_extractor_service.rs](/backend/src/domain/snapshot/content_extractor_service.rs) | Rust | -457 | -31 | -57 | -545 |
| [backend/src/domain/snapshot/html_parser_service.rs](/backend/src/domain/snapshot/html_parser_service.rs) | Rust | -198 | -29 | -41 | -268 |
| [backend/src/domain/snapshot/mod.rs](/backend/src/domain/snapshot/mod.rs) | Rust | -8 | -4 | -2 | -14 |
| [backend/src/domain/snapshot/snapshot_coordinator_service.rs](/backend/src/domain/snapshot/snapshot_coordinator_service.rs) | Rust | -280 | -23 | -55 | -358 |
| [backend/src/domain/snapshot/yjs_processor_service.rs](/backend/src/domain/snapshot/yjs_processor_service.rs) | Rust | -319 | -49 | -53 | -421 |
| [backend/src/domain/snapshot_service.rs](/backend/src/domain/snapshot_service.rs) | Rust | -17 | -11 | -6 | -34 |
| [backend/src/error/helpers.rs](/backend/src/error/helpers.rs) | Rust | -176 | -106 | -26 | -308 |
| [backend/src/error/mod.rs](/backend/src/error/mod.rs) | Rust | -11 | -16 | -3 | -30 |
| [backend/src/error/types.rs](/backend/src/error/types.rs) | Rust | -246 | -47 | -24 | -317 |
| [backend/src/external/mod.rs](/backend/src/external/mod.rs) | Rust | 0 | -12 | -1 | -13 |
| [backend/src/handlers/auth.rs](/backend/src/handlers/auth.rs) | Rust | -196 | -57 | -34 | -287 |
| [backend/src/handlers/claude_session_handler.rs](/backend/src/handlers/claude_session_handler.rs) | Rust | -85 | 0 | -12 | -97 |
| [backend/src/handlers/claude_websocket.rs](/backend/src/handlers/claude_websocket.rs) | Rust | -133 | -12 | -12 | -157 |
| [backend/src/handlers/mod.rs](/backend/src/handlers/mod.rs) | Rust | -6 | -4 | -1 | -11 |
| [backend/src/handlers/page_break_handlers.rs](/backend/src/handlers/page_break_handlers.rs) | Rust | -183 | -43 | -27 | -253 |
| [backend/src/handlers/script.rs](/backend/src/handlers/script.rs) | Rust | -184 | -41 | -34 | -259 |
| [backend/src/handlers/script_upload_handler.rs](/backend/src/handlers/script_upload_handler.rs) | Rust | -136 | -25 | -31 | -192 |
| [backend/src/infrastructure/config.rs](/backend/src/infrastructure/config.rs) | Rust | -85 | -16 | -5 | -106 |
| [backend/src/infrastructure/middleware.rs](/backend/src/infrastructure/middleware.rs) | Rust | -61 | -9 | -10 | -80 |
| [backend/src/infrastructure/mod.rs](/backend/src/infrastructure/mod.rs) | Rust | -4 | -16 | -2 | -22 |
| [backend/src/lib.rs](/backend/src/lib.rs) | Rust | -15 | -16 | -3 | -34 |
| [backend/src/main.rs](/backend/src/main.rs) | Rust | -78 | -48 | -21 | -147 |
| [backend/src/models/block.rs](/backend/src/models/block.rs) | Rust | -17 | -14 | -1 | -32 |
| [backend/src/models/edit.rs](/backend/src/models/edit.rs) | Rust | -12 | -9 | -1 | -22 |
| [backend/src/models/mod.rs](/backend/src/models/mod.rs) | Rust | -8 | -4 | 0 | -12 |
| [backend/src/models/script.rs](/backend/src/models/script.rs) | Rust | -14 | -10 | -1 | -25 |
| [backend/src/models/script_layout.rs](/backend/src/models/script_layout.rs) | Rust | -31 | -16 | -3 | -50 |
| [backend/src/models/script_share.rs](/backend/src/models/script_share.rs) | Rust | -37 | -14 | -5 | -56 |
| [backend/src/models/snapshot_meta.rs](/backend/src/models/snapshot_meta.rs) | Rust | -10 | 0 | -1 | -11 |
| [backend/src/models/user.rs](/backend/src/models/user.rs) | Rust | -13 | -9 | -1 | -23 |
| [backend/src/models/yjs_update.rs](/backend/src/models/yjs_update.rs) | Rust | -12 | 0 | -1 | -13 |
| [backend/src/networking/mod.rs](/backend/src/networking/mod.rs) | Rust | -5 | -16 | -2 | -23 |
| [backend/src/networking/websocket.rs](/backend/src/networking/websocket.rs) | Rust | -363 | -84 | -63 | -510 |
| [backend/src/repositories/block_repository.rs](/backend/src/repositories/block_repository.rs) | Rust | -81 | -9 | -15 | -105 |
| [backend/src/repositories/mod.rs](/backend/src/repositories/mod.rs) | Rust | -10 | -5 | -2 | -17 |
| [backend/src/repositories/script_repository.rs](/backend/src/repositories/script_repository.rs) | Rust | -169 | -13 | -35 | -217 |
| [backend/src/repositories/snapshot_repository.rs](/backend/src/repositories/snapshot_repository.rs) | Rust | -197 | -17 | -39 | -253 |
| [backend/src/repositories/user_repository.rs](/backend/src/repositories/user_repository.rs) | Rust | -151 | -12 | -31 | -194 |
| [backend/src/repositories/yjs_update_repository.rs](/backend/src/repositories/yjs_update_repository.rs) | Rust | -213 | -14 | -39 | -266 |
| [backend/src/services/async_db_writer.rs](/backend/src/services/async_db_writer.rs) | Rust | -64 | -9 | -7 | -80 |
| [backend/src/services/claude_session_monitor.rs](/backend/src/services/claude_session_monitor.rs) | Rust | -59 | -1 | -11 | -71 |
| [backend/src/services/claude_session_service.rs](/backend/src/services/claude_session_service.rs) | Rust | -339 | -32 | -49 | -420 |
| [backend/src/services/json_to_db_service.rs](/backend/src/services/json_to_db_service.rs) | Rust | -321 | -31 | -36 | -388 |
| [backend/src/services/mod.rs](/backend/src/services/mod.rs) | Rust | -12 | -17 | -2 | -31 |
| [backend/src/services/persistence_event.rs](/backend/src/services/persistence_event.rs) | Rust | -9 | -1 | -1 | -11 |
| [backend/src/services/prompt.md](/backend/src/services/prompt.md) | Markdown | -214 | 0 | -34 | -248 |
| [backend/src/services/snapshotting_service_v2.rs](/backend/src/services/snapshotting_service_v2.rs) | Rust | -71 | -5 | -17 | -93 |
| [backend/src/services/thumbnail.rs](/backend/src/services/thumbnail.rs) | Rust | -204 | -21 | -25 | -250 |
| [backend/src/utils/mod.rs](/backend/src/utils/mod.rs) | Rust | -1 | -7 | -2 | -10 |
| [backend/src/utils/test_yjs.rs](/backend/src/utils/test_yjs.rs) | Rust | -3 | -3 | -1 | -7 |
| [backend/test_multipage.json](/backend/test_multipage.json) | JSON | -109 | 0 | 0 | -109 |
| [backend/verify_insert.sql](/backend/verify_insert.sql) | MS SQL | -10 | -2 | -1 | -13 |
| [frontend/.dockerignore](/frontend/.dockerignore) | Ignore | 14 | 0 | 0 | 14 |
| [frontend/.lintstagedrc.json](/frontend/.lintstagedrc.json) | JSON | 10 | 0 | 0 | 10 |
| [frontend/android/app/build.gradle](/frontend/android/app/build.gradle) | Groovy | 79 | 5 | 10 | 94 |
| [frontend/android/app/capacitor.build.gradle](/frontend/android/app/capacitor.build.gradle) | Groovy | 12 | 1 | 7 | 20 |
| [frontend/android/app/src/main/AndroidManifest.xml](/frontend/android/app/src/main/AndroidManifest.xml) | XML | 33 | 1 | 4 | 38 |
| [frontend/android/app/src/main/java/com/romankuskowski/theatereditor/MainActivity.java](/frontend/android/app/src/main/java/com/romankuskowski/theatereditor/MainActivity.java) | Java | 14 | 2 | 3 | 19 |
| [frontend/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml](/frontend/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml) | XML | 34 | 0 | 1 | 35 |
| [frontend/android/app/src/main/res/drawable/ic_launcher_background.xml](/frontend/android/app/src/main/res/drawable/ic_launcher_background.xml) | XML | 170 | 0 | 1 | 171 |
| [frontend/android/app/src/main/res/layout/activity_main.xml](/frontend/android/app/src/main/res/layout/activity_main.xml) | XML | 11 | 0 | 2 | 13 |
| [frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml](/frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml) | XML | 9 | 0 | 0 | 9 |
| [frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml](/frontend/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml) | XML | 9 | 0 | 0 | 9 |
| [frontend/android/app/src/main/res/values/ic_launcher_background.xml](/frontend/android/app/src/main/res/values/ic_launcher_background.xml) | XML | 4 | 0 | 0 | 4 |
| [frontend/android/app/src/main/res/values/strings.xml](/frontend/android/app/src/main/res/values/strings.xml) | XML | 7 | 0 | 1 | 8 |
| [frontend/android/app/src/main/res/values/styles.xml](/frontend/android/app/src/main/res/values/styles.xml) | XML | 16 | 2 | 4 | 22 |
| [frontend/android/app/src/main/res/xml/file_paths.xml](/frontend/android/app/src/main/res/xml/file_paths.xml) | XML | 5 | 0 | 0 | 5 |
| [frontend/android/app/src/main/res/xml/network_security_config.xml](/frontend/android/app/src/main/res/xml/network_security_config.xml) | XML | 18 | 0 | 0 | 18 |
| [frontend/android/build.gradle](/frontend/android/build.gradle) | Groovy | 24 | 3 | 8 | 35 |
| [frontend/android/capacitor.settings.gradle](/frontend/android/capacitor.settings.gradle) | Groovy | 2 | 1 | 1 | 4 |
| [frontend/android/gradle.properties](/frontend/android/gradle.properties) | Properties | 4 | 17 | 8 | 29 |
| [frontend/android/gradle/wrapper/gradle-wrapper.properties](/frontend/android/gradle/wrapper/gradle-wrapper.properties) | Properties | 7 | 0 | 1 | 8 |
| [frontend/android/gradlew.bat](/frontend/android/gradlew.bat) | Batch | 41 | 32 | 22 | 95 |
| [frontend/android/settings.gradle](/frontend/android/settings.gradle) | Groovy | 4 | 0 | 1 | 5 |
| [frontend/android/variables.gradle](/frontend/android/variables.gradle) | Groovy | 16 | 0 | 0 | 16 |
| [frontend/capacitor.config.json](/frontend/capacitor.config.json) | JSON | 10 | 0 | 1 | 11 |
| [frontend/capacitor.config.ts](/frontend/capacitor.config.ts) | TypeScript | 12 | 0 | 3 | 15 |
| [frontend/index.html](/frontend/index.html) | HTML | 18 | 0 | 1 | 19 |
| [frontend/migrations/20250628204208_add_sharing_to_scripts.sql](/frontend/migrations/20250628204208_add_sharing_to_scripts.sql) | MS SQL | 0 | 1 | 1 | 2 |
| [frontend/package.json](/frontend/package.json) | JSON | 67 | 0 | 1 | 68 |
| [frontend/public/manifest.webmanifest](/frontend/public/manifest.webmanifest) | JSON | 46 | 0 | 1 | 47 |
| [frontend/public/microphone_test.html](/frontend/public/microphone_test.html) | HTML | 434 | 5 | 83 | 522 |
| [frontend/public/vite.svg](/frontend/public/vite.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/websocket_test.html](/frontend/public/websocket_test.html) | HTML | 78 | 0 | 16 | 94 |
| [frontend/src/App.css](/frontend/src/App.css) | CSS | 60 | 1 | 9 | 70 |
| [frontend/src/App.tsx](/frontend/src/App.tsx) | TypeScript JSX | 178 | 33 | 20 | 231 |
| [frontend/src/AuthContext.tsx](/frontend/src/AuthContext.tsx) | TypeScript JSX | 98 | 55 | 22 | 175 |
| [frontend/src/api.ts](/frontend/src/api.ts) | TypeScript | 150 | 20 | 47 | 217 |
| [frontend/src/assets/react.svg](/frontend/src/assets/react.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/src/components/App.test.tsx](/frontend/src/components/App.test.tsx) | TypeScript JSX | 9 | 0 | 1 | 10 |
| [frontend/src/components/Auth.module.css](/frontend/src/components/Auth.module.css) | CSS | 150 | 5 | 23 | 178 |
| [frontend/src/components/COMPONENT_HIERARCHY.md](/frontend/src/components/COMPONENT_HIERARCHY.md) | Markdown | 153 | 0 | 32 | 185 |
| [frontend/src/components/ErrorBoundary.tsx](/frontend/src/components/ErrorBoundary.tsx) | TypeScript JSX | 181 | 1 | 33 | 215 |
| [frontend/src/components/ErrorFallbacks.tsx](/frontend/src/components/ErrorFallbacks.tsx) | TypeScript JSX | 137 | 0 | 14 | 151 |
| [frontend/src/components/Header.module.css](/frontend/src/components/Header.module.css) | CSS | 193 | 3 | 27 | 223 |
| [frontend/src/components/Header.tsx](/frontend/src/components/Header.tsx) | TypeScript JSX | 290 | 26 | 44 | 360 |
| [frontend/src/components/LoadingStates.css](/frontend/src/components/LoadingStates.css) | CSS | 253 | 9 | 52 | 314 |
| [frontend/src/components/LoadingStates.tsx](/frontend/src/components/LoadingStates.tsx) | TypeScript JSX | 217 | 36 | 17 | 270 |
| [frontend/src/components/Login.tsx](/frontend/src/components/Login.tsx) | TypeScript JSX | 101 | 24 | 12 | 137 |
| [frontend/src/components/Register.tsx](/frontend/src/components/Register.tsx) | TypeScript JSX | 106 | 21 | 8 | 135 |
| [frontend/src/components/RouteErrorBoundary.tsx](/frontend/src/components/RouteErrorBoundary.tsx) | TypeScript JSX | 30 | 0 | 4 | 34 |
| [frontend/src/components/ScriptUploader.module.css](/frontend/src/components/ScriptUploader.module.css) | CSS | 161 | 8 | 24 | 193 |
| [frontend/src/components/ScriptUploader.tsx](/frontend/src/components/ScriptUploader.tsx) | TypeScript JSX | 124 | 5 | 21 | 150 |
| [frontend/src/components/SpeakerNameExtension.ts](/frontend/src/components/SpeakerNameExtension.ts) | TypeScript | 50 | 5 | 9 | 64 |
| [frontend/src/components/editor/CueDropdown.tsx](/frontend/src/components/editor/CueDropdown.tsx) | TypeScript JSX | 69 | 1 | 8 | 78 |
| [frontend/src/components/editor/CueTypeDropdown.tsx](/frontend/src/components/editor/CueTypeDropdown.tsx) | TypeScript JSX | 136 | 9 | 19 | 164 |
| [frontend/src/components/editor/FontSizeDropdown.tsx](/frontend/src/components/editor/FontSizeDropdown.tsx) | TypeScript JSX | 179 | 16 | 27 | 222 |
| [frontend/src/components/editor/FontSizeExtension.ts](/frontend/src/components/editor/FontSizeExtension.ts) | TypeScript | 58 | 6 | 7 | 71 |
| [frontend/src/components/editor/Ruler.tsx](/frontend/src/components/editor/Ruler.tsx) | TypeScript JSX | 427 | 42 | 41 | 510 |
| [frontend/src/components/editor/SearchBox.tsx](/frontend/src/components/editor/SearchBox.tsx) | TypeScript JSX | 281 | 27 | 44 | 352 |
| [frontend/src/components/editor/SpeakerDropdown.tsx](/frontend/src/components/editor/SpeakerDropdown.tsx) | TypeScript JSX | 136 | 10 | 23 | 169 |
| [frontend/src/components/editor/ViewModes/MultiPageView.tsx](/frontend/src/components/editor/ViewModes/MultiPageView.tsx) | TypeScript JSX | 395 | 44 | 56 | 495 |
| [frontend/src/components/editor/ViewModes/SinglePageView.tsx](/frontend/src/components/editor/ViewModes/SinglePageView.tsx) | TypeScript JSX | 134 | 7 | 12 | 153 |
| [frontend/src/components/editor/ViewModes/index.ts](/frontend/src/components/editor/ViewModes/index.ts) | TypeScript | 2 | 0 | 0 | 2 |
| [frontend/src/components/editor/components/AudioTranscription.css](/frontend/src/components/editor/components/AudioTranscription.css) | CSS | 327 | 5 | 52 | 384 |
| [frontend/src/components/editor/components/AudioTranscription.tsx](/frontend/src/components/editor/components/AudioTranscription.tsx) | TypeScript JSX | 652 | 28 | 103 | 783 |
| [frontend/src/components/editor/components/Editor.tsx](/frontend/src/components/editor/components/Editor.tsx) | TypeScript JSX | 648 | 91 | 100 | 839 |
| [frontend/src/components/editor/components/PageBreakIndicator.tsx](/frontend/src/components/editor/components/PageBreakIndicator.tsx) | TypeScript JSX | 219 | 20 | 39 | 278 |
| [frontend/src/components/editor/components/page/PageCanvas.tsx](/frontend/src/components/editor/components/page/PageCanvas.tsx) | TypeScript JSX | 20 | 5 | 4 | 29 |
| [frontend/src/components/editor/components/toolbar/Toolbar.tsx](/frontend/src/components/editor/components/toolbar/Toolbar.tsx) | TypeScript JSX | 667 | 67 | 77 | 811 |
| [frontend/src/components/editor/components/ui/LoadingSpinner.tsx](/frontend/src/components/editor/components/ui/LoadingSpinner.tsx) | TypeScript JSX | 21 | 4 | 3 | 28 |
| [frontend/src/components/editor/components/ui/StatusIndicator.tsx](/frontend/src/components/editor/components/ui/StatusIndicator.tsx) | TypeScript JSX | 113 | 10 | 11 | 134 |
| [frontend/src/components/editor/config/constants.ts](/frontend/src/components/editor/config/constants.ts) | TypeScript | 145 | 33 | 31 | 209 |
| [frontend/src/components/editor/config/index.ts](/frontend/src/components/editor/config/index.ts) | TypeScript | 1 | 4 | 1 | 6 |
| [frontend/src/components/editor/extensions/CueBlock.ts](/frontend/src/components/editor/extensions/CueBlock.ts) | TypeScript | 566 | 85 | 134 | 785 |
| [frontend/src/components/editor/extensions/CueConnectionMark.ts](/frontend/src/components/editor/extensions/CueConnectionMark.ts) | TypeScript | 133 | 15 | 16 | 164 |
| [frontend/src/components/editor/extensions/DialogueBlock.ts](/frontend/src/components/editor/extensions/DialogueBlock.ts) | TypeScript | 207 | 22 | 33 | 262 |
| [frontend/src/components/editor/extensions/DialogueText.ts](/frontend/src/components/editor/extensions/DialogueText.ts) | TypeScript | 13 | 2 | 3 | 18 |
| [frontend/src/components/editor/extensions/PageIndicator.ts](/frontend/src/components/editor/extensions/PageIndicator.ts) | TypeScript | 152 | 12 | 27 | 191 |
| [frontend/src/components/editor/extensions/SceneBlock.ts](/frontend/src/components/editor/extensions/SceneBlock.ts) | TypeScript | 158 | 17 | 22 | 197 |
| [frontend/src/components/editor/extensions/Speaker.ts](/frontend/src/components/editor/extensions/Speaker.ts) | TypeScript | 17 | 2 | 3 | 22 |
| [frontend/src/components/editor/extensions/TrailingNode.ts](/frontend/src/components/editor/extensions/TrailingNode.ts) | TypeScript | 50 | 9 | 13 | 72 |
| [frontend/src/components/editor/extensions/index.ts](/frontend/src/components/editor/extensions/index.ts) | TypeScript | 8 | 0 | 0 | 8 |
| [frontend/src/components/editor/hooks/useEditorCore.ts](/frontend/src/components/editor/hooks/useEditorCore.ts) | TypeScript | 439 | 60 | 59 | 558 |
| [frontend/src/components/editor/hooks/useResponsiveDesign.ts](/frontend/src/components/editor/hooks/useResponsiveDesign.ts) | TypeScript | 160 | 22 | 31 | 213 |
| [frontend/src/components/editor/index.ts](/frontend/src/components/editor/index.ts) | TypeScript | 13 | 6 | 5 | 24 |
| [frontend/src/components/editor/styles/cue-blocks.css](/frontend/src/components/editor/styles/cue-blocks.css) | CSS | 174 | 14 | 27 | 215 |
| [frontend/src/components/editor/styles/cue-connections.css](/frontend/src/components/editor/styles/cue-connections.css) | CSS | 165 | 15 | 28 | 208 |
| [frontend/src/components/editor/styles/page-indicators.css](/frontend/src/components/editor/styles/page-indicators.css) | CSS | 76 | 8 | 12 | 96 |
| [frontend/src/components/editor/styles/rehearsal-line.css](/frontend/src/components/editor/styles/rehearsal-line.css) | CSS | 29 | 3 | 4 | 36 |
| [frontend/src/components/editor/styles/responsive.css](/frontend/src/components/editor/styles/responsive.css) | CSS | 515 | 88 | 127 | 730 |
| [frontend/src/components/editor/styles/scene-blocks.css](/frontend/src/components/editor/styles/scene-blocks.css) | CSS | 82 | 11 | 12 | 105 |
| [frontend/src/components/editor/styles/search.css](/frontend/src/components/editor/styles/search.css) | CSS | 175 | 14 | 32 | 221 |
| [frontend/src/components/editor/styles/toolbar.css](/frontend/src/components/editor/styles/toolbar.css) | CSS | 342 | 98 | 101 | 541 |
| [frontend/src/components/editor/styles/variables.css](/frontend/src/components/editor/styles/variables.css) | CSS | 96 | 38 | 30 | 164 |
| [frontend/src/components/editor/types/index.ts](/frontend/src/components/editor/types/index.ts) | TypeScript | 313 | 31 | 69 | 413 |
| [frontend/src/components/editor/utils/contentConverters.ts](/frontend/src/components/editor/utils/contentConverters.ts) | TypeScript | 194 | 39 | 34 | 267 |
| [frontend/src/components/editor/utils/formatters.ts](/frontend/src/components/editor/utils/formatters.ts) | TypeScript | 77 | 27 | 6 | 110 |
| [frontend/src/components/editor/utils/pageBreakService.ts](/frontend/src/components/editor/utils/pageBreakService.ts) | TypeScript | 183 | 60 | 45 | 288 |
| [frontend/src/components/optimized/OptimizedHeader.tsx](/frontend/src/components/optimized/OptimizedHeader.tsx) | TypeScript JSX | 16 | 6 | 2 | 24 |
| [frontend/src/components/optimized/OptimizedScriptList.tsx](/frontend/src/components/optimized/OptimizedScriptList.tsx) | TypeScript JSX | 16 | 7 | 2 | 25 |
| [frontend/src/components/shared/Button.module.css](/frontend/src/components/shared/Button.module.css) | CSS | 89 | 5 | 18 | 112 |
| [frontend/src/components/shared/Button.tsx](/frontend/src/components/shared/Button.tsx) | TypeScript JSX | 54 | 18 | 4 | 76 |
| [frontend/src/components/shared/Card.module.css](/frontend/src/components/shared/Card.module.css) | CSS | 44 | 4 | 10 | 58 |
| [frontend/src/components/shared/Card.tsx](/frontend/src/components/shared/Card.tsx) | TypeScript JSX | 69 | 36 | 14 | 119 |
| [frontend/src/components/shared/index.ts](/frontend/src/components/shared/index.ts) | TypeScript | 8 | 13 | 6 | 27 |
| [frontend/src/config/websocket.ts](/frontend/src/config/websocket.ts) | TypeScript | 5 | 3 | 1 | 9 |
| [frontend/src/contexts/YjsDocumentContext.tsx](/frontend/src/contexts/YjsDocumentContext.tsx) | TypeScript JSX | 84 | 19 | 18 | 121 |
| [frontend/src/hooks/use3DTilt.ts](/frontend/src/hooks/use3DTilt.ts) | TypeScript | 58 | 7 | 14 | 79 |
| [frontend/src/hooks/use3DTiltEffect.ts](/frontend/src/hooks/use3DTiltEffect.ts) | TypeScript | 203 | 0 | 39 | 242 |
| [frontend/src/hooks/useCssTilt.ts](/frontend/src/hooks/useCssTilt.ts) | TypeScript | 43 | 5 | 11 | 59 |
| [frontend/src/hooks/useDebounce.ts](/frontend/src/hooks/useDebounce.ts) | TypeScript | 78 | 16 | 19 | 113 |
| [frontend/src/hooks/useDirectTilt.ts](/frontend/src/hooks/useDirectTilt.ts) | TypeScript | 37 | 5 | 11 | 53 |
| [frontend/src/hooks/useRouting.ts](/frontend/src/hooks/useRouting.ts) | TypeScript | 75 | 11 | 14 | 100 |
| [frontend/src/hooks/useSimpleTilt.ts](/frontend/src/hooks/useSimpleTilt.ts) | TypeScript | 53 | 4 | 12 | 69 |
| [frontend/src/hooks/useTiltEffect.ts](/frontend/src/hooks/useTiltEffect.ts) | TypeScript | 61 | 8 | 14 | 83 |
| [frontend/src/hooks/useUIState.ts](/frontend/src/hooks/useUIState.ts) | TypeScript | 30 | 5 | 7 | 42 |
| [frontend/src/hooks/useUploadState.ts](/frontend/src/hooks/useUploadState.ts) | TypeScript | 29 | 2 | 5 | 36 |
| [frontend/src/index.css](/frontend/src/index.css) | CSS | 436 | 71 | 82 | 589 |
| [frontend/src/main.tsx](/frontend/src/main.tsx) | TypeScript JSX | 19 | 9 | 4 | 32 |
| [frontend/src/mobile-test.html](/frontend/src/mobile-test.html) | HTML | 280 | 0 | 37 | 317 |
| [frontend/src/services/ApiService.ts](/frontend/src/services/ApiService.ts) | TypeScript | 156 | 47 | 38 | 241 |
| [frontend/src/services/ClaudeSessionService.ts](/frontend/src/services/ClaudeSessionService.ts) | TypeScript | 113 | 3 | 20 | 136 |
| [frontend/src/services/LoggingService.ts](/frontend/src/services/LoggingService.ts) | TypeScript | 252 | 63 | 46 | 361 |
| [frontend/src/services/RoutingService.ts](/frontend/src/services/RoutingService.ts) | TypeScript | 132 | 59 | 31 | 222 |
| [frontend/src/services/UploadStateManager.ts](/frontend/src/services/UploadStateManager.ts) | TypeScript | 108 | 7 | 21 | 136 |
| [frontend/src/services/yjsDocumentManager.ts](/frontend/src/services/yjsDocumentManager.ts) | TypeScript | 179 | 54 | 34 | 267 |
| [frontend/src/stores/UIStore.ts](/frontend/src/stores/UIStore.ts) | TypeScript | 67 | 36 | 14 | 117 |
| [frontend/src/styles/ErrorBoundary.css](/frontend/src/styles/ErrorBoundary.css) | CSS | 111 | 0 | 17 | 128 |
| [frontend/src/styles/ErrorFallbacks.css](/frontend/src/styles/ErrorFallbacks.css) | CSS | 130 | 0 | 24 | 154 |
| [frontend/src/test/auth.test.ts](/frontend/src/test/auth.test.ts) | TypeScript | 28 | 1 | 4 | 33 |
| [frontend/src/test/mocks/api.ts](/frontend/src/test/mocks/api.ts) | TypeScript | 33 | 0 | 5 | 38 |
| [frontend/src/test/mocks/data.ts](/frontend/src/test/mocks/data.ts) | TypeScript | 30 | 0 | 2 | 32 |
| [frontend/src/test/mocks/websocket.ts](/frontend/src/test/mocks/websocket.ts) | TypeScript | 37 | 1 | 7 | 45 |
| [frontend/src/test/setup.ts](/frontend/src/test/setup.ts) | TypeScript | 15 | 4 | 4 | 23 |
| [frontend/src/types.ts](/frontend/src/types.ts) | TypeScript | 121 | 96 | 14 | 231 |
| [frontend/src/types/common.ts](/frontend/src/types/common.ts) | TypeScript | 71 | 45 | 13 | 129 |
| [frontend/src/types/cue.ts](/frontend/src/types/cue.ts) | TypeScript | 24 | 0 | 4 | 28 |
| [frontend/src/utils/apiCache.ts](/frontend/src/utils/apiCache.ts) | TypeScript | 134 | 50 | 27 | 211 |
| [frontend/src/utils/csrf.ts](/frontend/src/utils/csrf.ts) | TypeScript | 31 | 14 | 7 | 52 |
| [frontend/src/utils/debug.ts](/frontend/src/utils/debug.ts) | TypeScript | 123 | 7 | 17 | 147 |
| [frontend/src/utils/mobile.ts](/frontend/src/utils/mobile.ts) | TypeScript | 146 | 58 | 38 | 242 |
| [frontend/src/utils/profiling.tsx](/frontend/src/utils/profiling.tsx) | TypeScript JSX | 113 | 26 | 24 | 163 |
| [frontend/src/utils/rateLimit.ts](/frontend/src/utils/rateLimit.ts) | TypeScript | 175 | 33 | 42 | 250 |
| [frontend/src/vite-env.d.ts](/frontend/src/vite-env.d.ts) | TypeScript | 7 | 2 | 3 | 12 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details