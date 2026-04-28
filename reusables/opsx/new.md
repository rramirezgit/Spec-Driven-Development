---
name: "OPSX: New"
description: Start a new change using the experimental artifact workflow (OPSX)
category: Workflow
tags: [workflow, artifacts, experimental]
sdd_version: "1.0"
---

Start a new change using the experimental artifact-driven approach.

**Input**: The argument after `/opsx:new` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" -> `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Determine the workflow schema**

   Use the default schema unless the user explicitly requests a different one.
   If user says "show workflows" -> run `openspec schemas --json` and let them choose.
   Otherwise: omit `--schema`.

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```

4. **Show the artifact status**
   ```bash
   openspec status --change "<name>"
   ```

5. **Get instructions for the first artifact**
   ```bash
   openspec instructions <first-artifact-id> --change "<name>"
   ```

6. **STOP and wait for user direction**

**Output**: Change name, schema, current status (0/N), first artifact template.
Prompt: "Ready to create the first artifact? Run `/opsx:continue`."

**Guardrails**
- Do NOT create any artifacts yet
- If name is invalid (not kebab-case), ask for valid name
- If change already exists, suggest `/opsx:continue` instead
