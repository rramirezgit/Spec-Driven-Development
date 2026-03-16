# Instructions

Review recent code changes and update documentation that should reflect them.

## Process

1. `git diff HEAD~1` or `git status` to see what changed
2. For each changed area:
   | Change type | Update |
   |-------------|--------|
   | New UI component/pattern | `ai-specs/specs/ui-design-system.mdc` |
   | New framework pattern | `ai-specs/specs/[stack]-standards.mdc` |
   | New shared component | `ai-specs/specs/ui-design-system.mdc` custom section |
   | New endpoint consumed | `CLAUDE.md` key files |
   | Architecture change | `ai-specs/specs/[stack]-standards.mdc` |
   | New dependency | `CLAUDE.md` + relevant spec |
3. Update maintaining existing structure and formatting
4. Confirm: "Updated: [files] — [summary of changes]"

## Rules
- Follow `ai-specs/specs/documentation-standards.mdc`
- Write in project's technical language
- Never remove existing docs unless directly contradicted
