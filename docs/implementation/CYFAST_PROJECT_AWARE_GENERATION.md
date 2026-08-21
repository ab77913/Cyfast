# CyFAST Project-Aware Generation

## Delivered scope

CyFAST script generation now requires an approved, immutable `AUTOMATION_PROJECT_PROFILE` before the `TEST_SCRIPTS` stage. The profile defines whether generation targets a `NEW` or `EXISTING` Robot Framework project and records its directory-aware file inventory, imports, libraries, keywords, and conventions.

Generated packages use explicit operations:

- `CREATE` adds a new root suite or resource file.
- `UPDATE` replaces a file that must already exist in an `EXISTING` project snapshot.
- `REUSE` references an unchanged file from the approved project snapshot. The server materializes its immutable content; the model cannot invent or silently change it.

## Safety and consistency gates

- Only normalized relative paths and approved text-file extensions are accepted.
- Absolute paths, traversal, backslashes, duplicates, missing update targets, and missing reuse targets are rejected.
- Existing file content is checksummed server-side and retained in the immutable profile.
- A lifecycle's `project_mode`, approved profile mode, and generated package mode must agree.
- `NEW` projects cannot update or reuse pre-existing files.
- The existing 128-file and 225,280-byte package limits remain authoritative.
- Generated scripts still require explicit review, package validation, a ready real target, meaningful actions and assertions, Robot output, recording/evidence, and truthful result classification.

This feature does not treat generation, static validation, or a reused file as real execution evidence.
