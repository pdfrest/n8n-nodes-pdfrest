---
name: sanitize-n8n-workflow-export
description: Sanitize n8n workflow export JSON files under `test/workflows/` for strict `n8n-cli workflow update` requests. Use when an n8n workflow definition JSON was freshly exported, contains API response metadata, produces `request/body must NOT have additional properties`, or needs its update payload checked before committing or sending it to n8n. This skill does not apply to GitHub Actions workflow YAML files under `.github/workflows/`.
---

# Sanitize an n8n Workflow Export

Convert an exported workflow API response into the editable workflow definition accepted by this repository's `n8n-cli workflow update` process.

## File scope and terminology

- **n8n workflow export**: A JSON API response exported from n8n.
- **n8n workflow definition file**: A sanitized JSON update payload committed under `test/workflows/`.
- **GitHub Actions workflow**: A YAML automation file under `.github/workflows/`. This skill never edits or validates these files.

The commands below use `test/workflows/error-aggregation-example.json` as a concrete n8n workflow definition filename. Replace it with the target JSON filename under `test/workflows/`. Do not pass a GitHub Actions workflow filename.

## Procedure

1. Inspect `git status` and the n8n workflow definition diff before editing. Preserve node IDs, credential references, parameters, connections, and unrelated user changes.
2. Run the bundled n8n export sanitizer from the repository root, replacing the example n8n workflow definition filename as needed:

   ```bash
   python3 .agents/skills/sanitize-n8n-workflow-export/scripts/sanitize_n8n_workflow_export.py test/workflows/error-aggregation-example.json
   ```

3. Confirm that the file has exactly these top-level keys:

   ```bash
   jq 'keys' test/workflows/error-aggregation-example.json
   ```

   The keys must be `name`, `nodes`, `connections`, `settings`, `staticData`, `nodeGroups`, and `pinData`. The script also removes the known unsupported nested settings `binaryMode` and `availableInMCP` while preserving other workflow settings.

4. Validate syntax and whitespace:

   ```bash
   jq empty test/workflows/error-aggregation-example.json
   git diff --check -- test/workflows/error-aggregation-example.json
   ```

5. Review the diff. Do not remove node-level editable data merely because it resembles metadata. Supply the workflow ID only as the positional CLI argument; never retain it in the JSON body.

## Strict-schema failures

Treat `request/body must NOT have additional properties` as a failed update. If the error points below `settings` or another retained object, compare that object with the public API schema for the target n8n instance and remove only response-only or unsupported properties. Update the sanitizer only when the property is consistently invalid for this repository's target workflow-update API.

## Check without editing

Use `--check` in CI or during review. It exits nonzero and lists removable fields when a file is not sanitized:

```bash
python3 .agents/skills/sanitize-n8n-workflow-export/scripts/sanitize_n8n_workflow_export.py --check test/workflows/error-aggregation-example.json
```
