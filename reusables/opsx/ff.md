---
name: "OPSX: Fast Forward"
description: Create a change and generate all artifacts needed for implementation in one go
category: Workflow
tags: [workflow, artifacts, experimental]
sdd_version: "1.0"
---

**Input**: Change name (kebab-case) or description of what to build.

**Steps**

1. **If no input, ask** via AskUserQuestion: "What change do you want to work on?"
   Derive kebab-case name from description.

2. **Create the change**
   ```bash
   openspec new change "<name>"
   ```

3. **Get artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse `applyRequires` and `artifacts`.

4. **Create artifacts in sequence until apply-ready**

   For each `ready` artifact:
   - `openspec instructions <artifact-id> --change "<name>" --json`
   - Parse: `context` + `rules` = constraints (NOT for output file), `template` = structure to use, `outputPath`, `dependencies`
   - Read dependency files for context
   - Write artifact to `outputPath` using `template` as structure
   - Progress: "Created <artifact-id>"
   - Re-check status after each. Stop when all `applyRequires` have `status: "done"`

   If artifact needs user input: AskUserQuestion, then continue.

5. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**: Change name, artifacts created, "Run `/opsx:apply` to implement."

**Guardrails**
- `context` and `rules` are constraints for YOU, not content for files
- If change already exists: ask continue or create new
- Verify each file exists after writing before proceeding
