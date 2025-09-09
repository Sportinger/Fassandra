> Understood. Here’s a blunt, code-accurate diagnosis of why the
  upload path is more brittle than manual creation, and how to make it
  simpler without touching anything right now.

  Why manual scripts “just work”

  - Single process, single state: Manual creation goes straight
  through the application service and writes a clean Yjs base state
  into yjs_base_states with a valid ‘default’ fragment and an empty
  paragraph. No intermediate protocols or re-decoding.
  - No legacy baggage: The base state shape matches what TipTap
  expects. The editor loads, applies zero updates, and your edits
  persist over WebSocket and compaction as expected.

  Why uploaded/imported scripts can lose edits after refresh

  - Multi-hop pipeline with mixed formats:
      - Split PDF → AI parse per 5 pages → emit chunked JSON →
  aggregate into a memory file → import script JSON → produce Yjs
  updates → persist updates → compact to base.
      - Historically, some imports persisted “y-websocket sync frames”
  instead of the raw Yjs Update payload. The loader expects Update
  bytes; it skipped frames it couldn’t decode, so on refresh only the
  old base was visible.
  - Legacy document structure mismatch:
      - Early imports sometimes had content only in legacy
  ‘prosemirror’ text, not in ‘default’. Server has a fallback to
  materialize ‘default’ from ‘prosemirror’ so the editor renders
  something, but if recent updates failed to apply (see above),
  refresh rebuilt ‘default’ from the old text and blew away your
  edits.
  - Cross-process orchestration risk:
      - The Claude CLI + json_mem.sh + yjs_to_db.sh flow adds failure
  modes you don’t have with manual creation. If any step silently
  diverges (e.g., path mapping, JSON append, importer expectations),
  the final state can be inconsistent.

  Are our fixes too complex?

  - The minimal “correct” fix is actually simple: ensure the loader
  can apply whatever is in yjs_recent_updates, and ensure imported
  scripts end with a proper base (compacted) state. That avoids future
  regressions and is consistent with how manual works.
  - You don’t need to rewrite the world; the brittle part was the
  decoding mismatch and older base content shape. Once those two are
  guaranteed, the upload route behaves like manual after the initial
  import.

  What would be a simpler design (if we choose to simplify)

  - Keep AI parsing if you must, but eliminate moving parts:
      - Stop relying on “recent updates” as the initial import
  format. Have the importer produce a complete Y.Doc and write it
  to yjs_base_states directly (base-only import), then start from
  there. This mirrors manual creation and avoids any loader re-
  decode path. You already “almost” do this on last chunk; enforce it
  unconditionally as the only initial write.
      - Alternatively, use the Node yjs-parser to generate the final
  Y.Doc server-side (no intermediates) and write base state in one
  shot.
  - If you keep chunking/AI for token/page limits:
      - Still emit DIFF updates per chunk, but always finalize with
  a compaction to base at the end. That gives you a canonical base so
  future loads don’t depend on replaying old updates.
  - Make migration one-shot:
      - The server fallback from ‘prosemirror’ → ‘default’ should
  happen once (or after compaction), not on every load. Once base has
  a valid ‘default’, never rebuild from ‘prosemirror’.

  Bottom line

  - Manual creation persists because it writes a correct base state
  in one step. Upload/import adds complexity (chunking, external CLI,
  recent updates vs base, legacy shape) which is where the fragility
  comes from.
  - The easiest durable simplification is to treat initial import as
  “base-only”: produce a correct TipTap ‘default’ document and write
  it to yjs_base_states (compacted), then use updates only for user
  edits afterward. No need to redesign the whole upload route; just
  ensure the end-of-import produces a valid base and the loader can
  decode legacy rows (for older scripts already in DB).
  - If we want to go even leaner later: drop the memory-file/CLI hop
  and run a single in-process importer that outputs a final Y.Doc; or
  keep the CLI but have it call an endpoint that only accepts “final
  base” rather than updates.

  No changes made per your request. If you want, I can map which
  existing scripts were imported pre-finalization (likely to exhibit
  the problem) and outline a one-time, safe migration to re-save their
  base states so they behave like manual ones.

▌ Explain this codebase         