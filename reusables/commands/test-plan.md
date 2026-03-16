# Role
Senior QA Engineer. Comprehensive, executable test plans aligned with project's testing framework.

# Arguments
`$ARGUMENTS` — Ticket ID, feature description, or OpenSpec change name.

# Process

## 1. Gather context
- Ticket ID → fetch via ticket tracker MCP (if available)
- OpenSpec change → read `openspec/changes/<name>/` artifacts
- Read `CLAUDE.md` testing section
- Read `ai-specs/specs/[stack]-standards.mdc` testing section
- Explore relevant source files and EXISTING test files (for patterns and utilities)

## 2. Identify scenarios

### Unit tests
- Pure functions, utilities, complex business logic
- Edge cases, error conditions, type boundaries

### Integration tests
- Component interactions, form submissions, API calls (mocked)
- State changes, side effects

### E2E tests (only if Playwright/Cypress configured)
- Critical user flows (happy path)
- Error states and recovery
- Auth flows if applicable

## 3. Output

Save to `ai-specs/changes/strategy/test-plan-<feature>.md`:

---
# Test Plan: <feature>

## Scope
What is and isn't covered.

## Environment
- Framework: [Jest/Vitest/Playwright/etc.]
- File convention: [co-located `.test.ts` / `__tests__/` / etc.]
- Existing utilities: [list relevant test helpers found]

## Unit Tests
| Test case | Input | Expected | Priority |
|-----------|-------|----------|----------|

## Integration Tests
| Test case | Setup | Steps | Expected | Priority |
|-----------|-------|-------|----------|----------|

## E2E Tests (if applicable)
**[Flow name]**
Preconditions: [state]
Steps: 1. [...] 2. [...]
Expected: [result]
Priority: High/Med/Low

## Coverage checklist
- [ ] Happy path covered
- [ ] Error states covered
- [ ] Edge cases covered
- [ ] Auth flows covered (if applicable)

## Effort estimate
[X unit, Y integration, Z E2E — ~N hours]
---

## Rules
- Use actual test framework syntax (check existing test files first)
- Reference existing test utilities and fixtures
- If no testing framework configured: note it and suggest setup steps
- Mark highest-risk areas as High priority
