# Details

Date : 2025-07-15 02:52:59

Directory /home/admins/projects/pessoa

Total : 172 files,  20773 codes, 3507 comments, 3669 blanks, all 27949 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [.github/workflows/deploy.yml](/.github/workflows/deploy.yml) | YAML | 0 | 20 | 1 | 21 |
| [backend/.dockerignore](/backend/.dockerignore) | Ignore | 3 | 2 | 0 | 5 |
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
| [backend/security_verification.py](/backend/security_verification.py) | Python | 318 | 24 | 88 | 430 |
| [backend/src/analysis/errors.rs](/backend/src/analysis/errors.rs) | Rust | 10 | 1 | 1 | 12 |
| [backend/src/analysis/mod.rs](/backend/src/analysis/mod.rs) | Rust | 3 | 5 | 1 | 9 |
| [backend/src/analysis/parser.rs](/backend/src/analysis/parser.rs) | Rust | 108 | 117 | 22 | 247 |
| [backend/src/analysis/structs.rs](/backend/src/analysis/structs.rs) | Rust | 96 | 20 | 18 | 134 |
| [backend/src/application/mod.rs](/backend/src/application/mod.rs) | Rust | 8 | 4 | 2 | 14 |
| [backend/src/application/page_break_application_service.rs](/backend/src/application/page_break_application_service.rs) | Rust | 243 | 45 | 43 | 331 |
| [backend/src/application/script_application_service.rs](/backend/src/application/script_application_service.rs) | Rust | 521 | 55 | 80 | 656 |
| [backend/src/application/script_sharing_application_service.rs](/backend/src/application/script_sharing_application_service.rs) | Rust | 206 | 30 | 34 | 270 |
| [backend/src/application/thumbnail_application_service.rs](/backend/src/application/thumbnail_application_service.rs) | Rust | 132 | 24 | 26 | 182 |
| [backend/src/auth/core.rs](/backend/src/auth/core.rs) | Rust | 333 | 150 | 66 | 549 |
| [backend/src/auth/helpers.rs](/backend/src/auth/helpers.rs) | Rust | 42 | 3 | 5 | 50 |
| [backend/src/auth/mod.rs](/backend/src/auth/mod.rs) | Rust | 10 | 16 | 3 | 29 |
| [backend/src/core/lib.rs](/backend/src/core/lib.rs) | Rust | 37 | 12 | 8 | 57 |
| [backend/src/core/mod.rs](/backend/src/core/mod.rs) | Rust | 6 | 15 | 2 | 23 |
| [backend/src/core/server.rs](/backend/src/core/server.rs) | Rust | 169 | 20 | 29 | 218 |
| [backend/src/core/service_manager.rs](/backend/src/core/service_manager.rs) | Rust | 211 | 46 | 42 | 299 |
| [backend/src/domain/collaboration_service.rs](/backend/src/domain/collaboration_service.rs) | Rust | 17 | 11 | 6 | 34 |
| [backend/src/domain/content_service.rs](/backend/src/domain/content_service.rs) | Rust | 13 | 9 | 5 | 27 |
| [backend/src/domain/mod.rs](/backend/src/domain/mod.rs) | Rust | 9 | 5 | 2 | 16 |
| [backend/src/domain/script_service.rs](/backend/src/domain/script_service.rs) | Rust | 287 | 63 | 75 | 425 |
| [backend/src/domain/snapshot/content_extractor_service.rs](/backend/src/domain/snapshot/content_extractor_service.rs) | Rust | 407 | 31 | 57 | 495 |
| [backend/src/domain/snapshot/html_parser_service.rs](/backend/src/domain/snapshot/html_parser_service.rs) | Rust | 198 | 29 | 41 | 268 |
| [backend/src/domain/snapshot/mod.rs](/backend/src/domain/snapshot/mod.rs) | Rust | 8 | 4 | 2 | 14 |
| [backend/src/domain/snapshot/snapshot_coordinator_service.rs](/backend/src/domain/snapshot/snapshot_coordinator_service.rs) | Rust | 233 | 22 | 49 | 304 |
| [backend/src/domain/snapshot/yjs_processor_service.rs](/backend/src/domain/snapshot/yjs_processor_service.rs) | Rust | 214 | 23 | 32 | 269 |
| [backend/src/domain/snapshot_service.rs](/backend/src/domain/snapshot_service.rs) | Rust | 17 | 11 | 6 | 34 |
| [backend/src/error/helpers.rs](/backend/src/error/helpers.rs) | Rust | 176 | 106 | 26 | 308 |
| [backend/src/error/mod.rs](/backend/src/error/mod.rs) | Rust | 11 | 16 | 3 | 30 |
| [backend/src/error/types.rs](/backend/src/error/types.rs) | Rust | 246 | 47 | 24 | 317 |
| [backend/src/external/gemini_api.rs](/backend/src/external/gemini_api.rs) | Rust | 474 | 79 | 73 | 626 |
| [backend/src/external/mod.rs](/backend/src/external/mod.rs) | Rust | 6 | 15 | 2 | 23 |
| [backend/src/handlers/auth.rs](/backend/src/handlers/auth.rs) | Rust | 84 | 36 | 15 | 135 |
| [backend/src/handlers/mod.rs](/backend/src/handlers/mod.rs) | Rust | 3 | 4 | 1 | 8 |
| [backend/src/handlers/page_break_handlers.rs](/backend/src/handlers/page_break_handlers.rs) | Rust | 183 | 43 | 27 | 253 |
| [backend/src/handlers/script.rs](/backend/src/handlers/script.rs) | Rust | 174 | 49 | 35 | 258 |
| [backend/src/infrastructure/config.rs](/backend/src/infrastructure/config.rs) | Rust | 85 | 16 | 5 | 106 |
| [backend/src/infrastructure/middleware.rs](/backend/src/infrastructure/middleware.rs) | Rust | 61 | 9 | 10 | 80 |
| [backend/src/infrastructure/mod.rs](/backend/src/infrastructure/mod.rs) | Rust | 4 | 16 | 2 | 22 |
| [backend/src/lib.rs](/backend/src/lib.rs) | Rust | 16 | 31 | 3 | 50 |
| [backend/src/main.rs](/backend/src/main.rs) | Rust | 78 | 48 | 21 | 147 |
| [backend/src/models/block.rs](/backend/src/models/block.rs) | Rust | 15 | 12 | 1 | 28 |
| [backend/src/models/edit.rs](/backend/src/models/edit.rs) | Rust | 12 | 9 | 1 | 22 |
| [backend/src/models/mod.rs](/backend/src/models/mod.rs) | Rust | 8 | 4 | 0 | 12 |
| [backend/src/models/script.rs](/backend/src/models/script.rs) | Rust | 14 | 10 | 1 | 25 |
| [backend/src/models/script_layout.rs](/backend/src/models/script_layout.rs) | Rust | 31 | 16 | 3 | 50 |
| [backend/src/models/script_share.rs](/backend/src/models/script_share.rs) | Rust | 37 | 14 | 5 | 56 |
| [backend/src/models/snapshot_meta.rs](/backend/src/models/snapshot_meta.rs) | Rust | 10 | 0 | 1 | 11 |
| [backend/src/models/user.rs](/backend/src/models/user.rs) | Rust | 13 | 9 | 1 | 23 |
| [backend/src/models/yjs_update.rs](/backend/src/models/yjs_update.rs) | Rust | 12 | 0 | 1 | 13 |
| [backend/src/networking/mod.rs](/backend/src/networking/mod.rs) | Rust | 5 | 16 | 2 | 23 |
| [backend/src/networking/websocket.rs](/backend/src/networking/websocket.rs) | Rust | 270 | 63 | 52 | 385 |
| [backend/src/prompts/mod.rs](/backend/src/prompts/mod.rs) | Rust | 0 | 11 | 1 | 12 |
| [backend/src/repositories/block_repository.rs](/backend/src/repositories/block_repository.rs) | Rust | 77 | 9 | 15 | 101 |
| [backend/src/repositories/mod.rs](/backend/src/repositories/mod.rs) | Rust | 10 | 5 | 2 | 17 |
| [backend/src/repositories/script_repository.rs](/backend/src/repositories/script_repository.rs) | Rust | 169 | 13 | 35 | 217 |
| [backend/src/repositories/snapshot_repository.rs](/backend/src/repositories/snapshot_repository.rs) | Rust | 197 | 17 | 39 | 253 |
| [backend/src/repositories/user_repository.rs](/backend/src/repositories/user_repository.rs) | Rust | 135 | 11 | 27 | 173 |
| [backend/src/repositories/yjs_update_repository.rs](/backend/src/repositories/yjs_update_repository.rs) | Rust | 213 | 14 | 39 | 266 |
| [backend/src/services/async_db_writer.rs](/backend/src/services/async_db_writer.rs) | Rust | 48 | 5 | 5 | 58 |
| [backend/src/services/mod.rs](/backend/src/services/mod.rs) | Rust | 8 | 16 | 2 | 26 |
| [backend/src/services/persistence_event.rs](/backend/src/services/persistence_event.rs) | Rust | 9 | 1 | 1 | 11 |
| [backend/src/services/snapshotting_service_v2.rs](/backend/src/services/snapshotting_service_v2.rs) | Rust | 71 | 5 | 17 | 93 |
| [backend/src/services/thumbnail.rs](/backend/src/services/thumbnail.rs) | Rust | 204 | 21 | 25 | 250 |
| [backend/src/utils/mod.rs](/backend/src/utils/mod.rs) | Rust | 1 | 7 | 2 | 10 |
| [backend/src/utils/test_yjs.rs](/backend/src/utils/test_yjs.rs) | Rust | 3 | 3 | 1 | 7 |
| [debug-test.js](/debug-test.js) | JavaScript | 25 | 7 | 9 | 41 |
| [debug-vision-helper.js](/debug-vision-helper.js) | JavaScript | 59 | 6 | 14 | 79 |
| [frontend/.dockerignore](/frontend/.dockerignore) | Ignore | 6 | 5 | 4 | 15 |
| [frontend/index.html](/frontend/index.html) | HTML | 17 | 0 | 1 | 18 |
| [frontend/migrations/20250628204208_add_sharing_to_scripts.sql](/frontend/migrations/20250628204208_add_sharing_to_scripts.sql) | MS SQL | 0 | 1 | 1 | 2 |
| [frontend/nginx-https-multi-domain.conf](/frontend/nginx-https-multi-domain.conf) | Properties | 125 | 18 | 23 | 166 |
| [frontend/nginx-https.conf](/frontend/nginx-https.conf) | Properties | 65 | 11 | 9 | 85 |
| [frontend/nginx-local.conf](/frontend/nginx-local.conf) | Properties | 65 | 11 | 9 | 85 |
| [frontend/nginx.conf](/frontend/nginx.conf) | Properties | 43 | 13 | 6 | 62 |
| [frontend/package.json](/frontend/package.json) | JSON | 57 | 0 | 1 | 58 |
| [frontend/public/microphone_test.html](/frontend/public/microphone_test.html) | HTML | 434 | 5 | 83 | 522 |
| [frontend/public/vite.svg](/frontend/public/vite.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/websocket_test.html](/frontend/public/websocket_test.html) | HTML | 78 | 0 | 16 | 94 |
| [frontend/src/App.css](/frontend/src/App.css) | CSS | 60 | 1 | 9 | 70 |
| [frontend/src/App.tsx](/frontend/src/App.tsx) | TypeScript JSX | 176 | 52 | 28 | 256 |
| [frontend/src/AuthContext.tsx](/frontend/src/AuthContext.tsx) | TypeScript JSX | 124 | 55 | 24 | 203 |
| [frontend/src/api-original.ts](/frontend/src/api-original.ts) | TypeScript | 465 | 233 | 84 | 782 |
| [frontend/src/api-refactored.ts](/frontend/src/api-refactored.ts) | TypeScript | 111 | 15 | 41 | 167 |
| [frontend/src/api.test.ts](/frontend/src/api.test.ts) | TypeScript | 23 | 0 | 6 | 29 |
| [frontend/src/api.ts](/frontend/src/api.ts) | TypeScript | 125 | 15 | 43 | 183 |
| [frontend/src/assets/react.svg](/frontend/src/assets/react.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/src/components/App.test.tsx](/frontend/src/components/App.test.tsx) | TypeScript JSX | 9 | 0 | 1 | 10 |
| [frontend/src/components/Auth.module.css](/frontend/src/components/Auth.module.css) | CSS | 150 | 5 | 23 | 178 |
| [frontend/src/components/Breadcrumb.module.css](/frontend/src/components/Breadcrumb.module.css) | CSS | 46 | 0 | 5 | 51 |
| [frontend/src/components/Breadcrumb.tsx](/frontend/src/components/Breadcrumb.tsx) | TypeScript JSX | 37 | 0 | 4 | 41 |
| [frontend/src/components/Header.module.css](/frontend/src/components/Header.module.css) | CSS | 193 | 3 | 27 | 223 |
| [frontend/src/components/Header.tsx](/frontend/src/components/Header.tsx) | TypeScript JSX | 287 | 26 | 44 | 357 |
| [frontend/src/components/Login.tsx](/frontend/src/components/Login.tsx) | TypeScript JSX | 90 | 19 | 11 | 120 |
| [frontend/src/components/Register.tsx](/frontend/src/components/Register.tsx) | TypeScript JSX | 104 | 19 | 9 | 132 |
| [frontend/src/components/ScriptList.module.css](/frontend/src/components/ScriptList.module.css) | CSS | 933 | 30 | 150 | 1,113 |
| [frontend/src/components/ScriptList.tsx](/frontend/src/components/ScriptList.tsx) | TypeScript JSX | 751 | 72 | 109 | 932 |
| [frontend/src/components/ScriptUploader.module.css](/frontend/src/components/ScriptUploader.module.css) | CSS | 35 | 0 | 3 | 38 |
| [frontend/src/components/ScriptUploader.tsx](/frontend/src/components/ScriptUploader.tsx) | TypeScript JSX | 88 | 5 | 15 | 108 |
| [frontend/src/components/SpeakerNameExtension.ts](/frontend/src/components/SpeakerNameExtension.ts) | TypeScript | 50 | 5 | 9 | 64 |
| [frontend/src/components/editor/FontSizeDropdown.tsx](/frontend/src/components/editor/FontSizeDropdown.tsx) | TypeScript JSX | 178 | 16 | 27 | 221 |
| [frontend/src/components/editor/FontSizeExtension.ts](/frontend/src/components/editor/FontSizeExtension.ts) | TypeScript | 58 | 6 | 7 | 71 |
| [frontend/src/components/editor/Ruler.tsx](/frontend/src/components/editor/Ruler.tsx) | TypeScript JSX | 426 | 42 | 41 | 509 |
| [frontend/src/components/editor/SpeakerDropdown.tsx](/frontend/src/components/editor/SpeakerDropdown.tsx) | TypeScript JSX | 133 | 9 | 23 | 165 |
| [frontend/src/components/editor/ViewModes/MultiPageView.tsx](/frontend/src/components/editor/ViewModes/MultiPageView.tsx) | TypeScript JSX | 387 | 44 | 55 | 486 |
| [frontend/src/components/editor/ViewModes/SinglePageView.tsx](/frontend/src/components/editor/ViewModes/SinglePageView.tsx) | TypeScript JSX | 177 | 9 | 20 | 206 |
| [frontend/src/components/editor/ViewModes/index.ts](/frontend/src/components/editor/ViewModes/index.ts) | TypeScript | 2 | 0 | 0 | 2 |
| [frontend/src/components/editor/components/AudioTranscription.css](/frontend/src/components/editor/components/AudioTranscription.css) | CSS | 327 | 5 | 52 | 384 |
| [frontend/src/components/editor/components/AudioTranscription.tsx](/frontend/src/components/editor/components/AudioTranscription.tsx) | TypeScript JSX | 651 | 28 | 103 | 782 |
| [frontend/src/components/editor/components/Editor.tsx](/frontend/src/components/editor/components/Editor.tsx) | TypeScript JSX | 506 | 72 | 79 | 657 |
| [frontend/src/components/editor/components/PageBreakIndicator.tsx](/frontend/src/components/editor/components/PageBreakIndicator.tsx) | TypeScript JSX | 89 | 0 | 14 | 103 |
| [frontend/src/components/editor/components/page/PageCanvas.tsx](/frontend/src/components/editor/components/page/PageCanvas.tsx) | TypeScript JSX | 19 | 5 | 4 | 28 |
| [frontend/src/components/editor/components/toolbar/Toolbar.tsx](/frontend/src/components/editor/components/toolbar/Toolbar.tsx) | TypeScript JSX | 568 | 60 | 71 | 699 |
| [frontend/src/components/editor/components/ui/ErrorDisplay.tsx](/frontend/src/components/editor/components/ui/ErrorDisplay.tsx) | TypeScript JSX | 24 | 4 | 4 | 32 |
| [frontend/src/components/editor/components/ui/LoadingSpinner.tsx](/frontend/src/components/editor/components/ui/LoadingSpinner.tsx) | TypeScript JSX | 21 | 4 | 3 | 28 |
| [frontend/src/components/editor/components/ui/StatusIndicator.tsx](/frontend/src/components/editor/components/ui/StatusIndicator.tsx) | TypeScript JSX | 113 | 10 | 11 | 134 |
| [frontend/src/components/editor/config/constants.ts](/frontend/src/components/editor/config/constants.ts) | TypeScript | 145 | 33 | 31 | 209 |
| [frontend/src/components/editor/config/index.ts](/frontend/src/components/editor/config/index.ts) | TypeScript | 1 | 4 | 1 | 6 |
| [frontend/src/components/editor/extensions/DialogueBlock.ts](/frontend/src/components/editor/extensions/DialogueBlock.ts) | TypeScript | 95 | 10 | 15 | 120 |
| [frontend/src/components/editor/extensions/DialogueText.ts](/frontend/src/components/editor/extensions/DialogueText.ts) | TypeScript | 13 | 2 | 3 | 18 |
| [frontend/src/components/editor/extensions/Speaker.ts](/frontend/src/components/editor/extensions/Speaker.ts) | TypeScript | 13 | 2 | 3 | 18 |
| [frontend/src/components/editor/extensions/index.ts](/frontend/src/components/editor/extensions/index.ts) | TypeScript | 3 | 0 | 0 | 3 |
| [frontend/src/components/editor/hooks/index.ts](/frontend/src/components/editor/hooks/index.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [frontend/src/components/editor/hooks/useEditorCore.ts](/frontend/src/components/editor/hooks/useEditorCore.ts) | TypeScript | 292 | 38 | 47 | 377 |
| [frontend/src/components/editor/hooks/useEditorInstance.ts](/frontend/src/components/editor/hooks/useEditorInstance.ts) | TypeScript | 215 | 31 | 25 | 271 |
| [frontend/src/components/editor/hooks/useEditorState.ts](/frontend/src/components/editor/hooks/useEditorState.ts) | TypeScript | 67 | 20 | 14 | 101 |
| [frontend/src/components/editor/hooks/useLayoutManagement.ts](/frontend/src/components/editor/hooks/useLayoutManagement.ts) | TypeScript | 142 | 13 | 31 | 186 |
| [frontend/src/components/editor/hooks/useResponsiveDesign.ts](/frontend/src/components/editor/hooks/useResponsiveDesign.ts) | TypeScript | 159 | 22 | 31 | 212 |
| [frontend/src/components/editor/hooks/useYjsConnection.ts](/frontend/src/components/editor/hooks/useYjsConnection.ts) | TypeScript | 354 | 61 | 49 | 464 |
| [frontend/src/components/editor/index.ts](/frontend/src/components/editor/index.ts) | TypeScript | 15 | 7 | 6 | 28 |
| [frontend/src/components/editor/styles/responsive.css](/frontend/src/components/editor/styles/responsive.css) | CSS | 502 | 86 | 124 | 712 |
| [frontend/src/components/editor/styles/toolbar.css](/frontend/src/components/editor/styles/toolbar.css) | CSS | 328 | 51 | 87 | 466 |
| [frontend/src/components/editor/styles/variables.css](/frontend/src/components/editor/styles/variables.css) | CSS | 96 | 38 | 30 | 164 |
| [frontend/src/components/editor/types/index.ts](/frontend/src/components/editor/types/index.ts) | TypeScript | 309 | 31 | 69 | 409 |
| [frontend/src/components/editor/utils/contentConverters.ts](/frontend/src/components/editor/utils/contentConverters.ts) | TypeScript | 120 | 23 | 24 | 167 |
| [frontend/src/components/editor/utils/formatters.ts](/frontend/src/components/editor/utils/formatters.ts) | TypeScript | 76 | 27 | 6 | 109 |
| [frontend/src/index.css](/frontend/src/index.css) | CSS | 349 | 61 | 66 | 476 |
| [frontend/src/main.tsx](/frontend/src/main.tsx) | TypeScript JSX | 12 | 7 | 3 | 22 |
| [frontend/src/mobile-test.html](/frontend/src/mobile-test.html) | HTML | 280 | 0 | 37 | 317 |
| [frontend/src/services/ApiService.ts](/frontend/src/services/ApiService.ts) | TypeScript | 131 | 39 | 33 | 203 |
| [frontend/src/test/auth.test.ts](/frontend/src/test/auth.test.ts) | TypeScript | 28 | 1 | 4 | 33 |
| [frontend/src/test/mocks/api.ts](/frontend/src/test/mocks/api.ts) | TypeScript | 33 | 0 | 5 | 38 |
| [frontend/src/test/mocks/data.ts](/frontend/src/test/mocks/data.ts) | TypeScript | 30 | 0 | 2 | 32 |
| [frontend/src/test/mocks/websocket.ts](/frontend/src/test/mocks/websocket.ts) | TypeScript | 37 | 1 | 7 | 45 |
| [frontend/src/test/scripts.test.ts](/frontend/src/test/scripts.test.ts) | TypeScript | 41 | 2 | 8 | 51 |
| [frontend/src/test/setup.ts](/frontend/src/test/setup.ts) | TypeScript | 15 | 4 | 4 | 23 |
| [frontend/src/test/websocket.test.ts](/frontend/src/test/websocket.test.ts) | TypeScript | 74 | 4 | 8 | 86 |
| [frontend/src/types.ts](/frontend/src/types.ts) | TypeScript | 112 | 91 | 13 | 216 |
| [frontend/src/utils/debug.ts](/frontend/src/utils/debug.ts) | TypeScript | 122 | 6 | 16 | 144 |
| [frontend/src/utils/mobile.ts](/frontend/src/utils/mobile.ts) | TypeScript | 146 | 58 | 38 | 242 |
| [frontend/src/vite-env.d.ts](/frontend/src/vite-env.d.ts) | TypeScript | 7 | 2 | 3 | 12 |
| [package.json](/package.json) | JSON | 41 | 0 | 1 | 42 |
| [reset_database.js](/reset_database.js) | JavaScript | 63 | 11 | 15 | 89 |
| [run-complete-test.js](/run-complete-test.js) | JavaScript | 104 | 4 | 26 | 134 |
| [tests/mcp-database-verification.spec.js](/tests/mcp-database-verification.spec.js) | JavaScript | 249 | 31 | 65 | 345 |
| [tests/pessoa-complete-workflow-with-database-verification.spec.js](/tests/pessoa-complete-workflow-with-database-verification.spec.js) | JavaScript | 256 | 65 | 86 | 407 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)