---
name: "OPSX: Verify"
description: Verify implementation matches change artifacts before archiving
category: Workflow
tags: [workflow, verify]
---

**Input**: Optional change name. If omitted, prompt.

**Steps**

1. **Select change** — prompt if not provided.

2. **Load artifacts**:
   ```bash
   openspec status --change "<name>" --json
   openspec instructions apply --change "<name>" --json
   ```
   Read all `contextFiles`.

3. **Verify 3 dimensions**:
   - **Completeness**: Task checkboxes + spec coverage
   - **Correctness**: Requirements implemented, scenarios covered
   - **Coherence**: Design adherence, pattern consistency
   Each issue: CRITICAL | WARNING | SUGGESTION

4. **Output report**:
   - Scorecard table (3 dimensions × status)
   - Issues by priority with actionable recommendation for each
   - Verdict: ✅ Ready to archive | ⚠️ Issues to resolve

**Guardrails**
- Every issue needs a specific recommendation
- Prefer SUGGESTION > WARNING > CRITICAL when uncertain
- Gracefully handle missing artifacts
