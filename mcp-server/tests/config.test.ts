import { describe, it, expect } from "vitest";
import { parseProfile } from "../src/config.js";

describe("parseProfile — commitStyle (V4.14)", () => {
  it("defaults to 'standard' when Commit Style is absent", () => {
    const profile = `# Proyecto: demo
# Tipo: backend
# Tracker: jira
# Tracker CloudId: abc-123
# Idioma: es`;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("standard");
  });

  it("parses 'conventional' explicitly", () => {
    const profile = `# Proyecto: demo
# Tipo: backend
# Tracker: jira
# Tracker CloudId: abc-123
# Idioma: es
# Commit Style: conventional`;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("conventional");
  });

  it("parses 'standard' explicitly", () => {
    const profile = `# Proyecto: demo
# Commit Style: standard
# Tracker: jira`;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("standard");
  });

  it("is case-insensitive — 'Conventional' resolves to conventional", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Commit Style: Conventional`;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("conventional");
  });

  it("falls back to 'standard' for unknown values (no silent corruption)", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Commit Style: gitmoji`;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("standard");
  });

  it("trims whitespace around the value", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Commit Style:    conventional   `;
    const config = parseProfile(profile);
    expect(config.commitStyle).toBe("conventional");
  });
});

describe("parseProfile — docusaurus (V4.16)", () => {
  it("leaves docusaurus undefined when no keys present (V4.15 behavior preserved)", () => {
    const profile = `# Proyecto: demo
# Tipo: backend
# Tracker: jira
# Idioma: es`;
    const config = parseProfile(profile);
    expect(config.docusaurus).toBeUndefined();
  });

  it("leaves docusaurus undefined when Docusaurus Enabled is 'false'", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Docusaurus Enabled: false
# Docusaurus Root: apps/docs
# Docusaurus Docs Path: docs`;
    const config = parseProfile(profile);
    expect(config.docusaurus).toBeUndefined();
  });

  it("parses docusaurus config when enabled", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Docusaurus Enabled: true
# Docusaurus Root: apps/docs
# Docusaurus Docs Path: docs`;
    const config = parseProfile(profile);
    expect(config.docusaurus).toBeDefined();
    expect(config.docusaurus?.enabled).toBe(true);
    expect(config.docusaurus?.root).toBe("apps/docs");
    expect(config.docusaurus?.docsPath).toBe("docs");
    expect(config.docusaurus?.mode).toBe("critical");
  });

  it("uses sensible defaults when only Enabled is set", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Docusaurus Enabled: true`;
    const config = parseProfile(profile);
    expect(config.docusaurus?.root).toBe(".");
    expect(config.docusaurus?.docsPath).toBe("docs");
  });

  it("is case-insensitive on the Enabled flag", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Docusaurus Enabled: TRUE
# Docusaurus Root: website`;
    const config = parseProfile(profile);
    expect(config.docusaurus?.enabled).toBe(true);
    expect(config.docusaurus?.root).toBe("website");
  });

  it("trims whitespace around root and docsPath", () => {
    const profile = `# Proyecto: demo
# Tracker: jira
# Docusaurus Enabled: true
# Docusaurus Root:   apps/docs
# Docusaurus Docs Path:   content/docs   `;
    const config = parseProfile(profile);
    expect(config.docusaurus?.root).toBe("apps/docs");
    expect(config.docusaurus?.docsPath).toBe("content/docs");
  });
});

describe("parseProfile — backward compat preserved", () => {
  it("still parses Multi Target Mode and slugs alongside commitStyle", () => {
    const profile = `# Proyecto: adam360
# Tipo: monorepo-fullstack
# Multi Target Mode: true
# Subproject Slugs: core-api, playground, storybook
# Tracker: jira
# Tracker CloudId: cloud-xyz
# Commit Style: conventional

## Subprojects

### core-api
**Path**: apps/core-api
**Framework**: NestJS 11
**Type**: backend

### playground
**Path**: apps/playground
**Framework**: Next.js 16
**Type**: frontend
`;
    const config = parseProfile(profile);
    expect(config.multiTargetMode).toBe(true);
    expect(config.subprojectSlugs).toEqual(["core-api", "playground", "storybook"]);
    expect(config.commitStyle).toBe("conventional");
    expect(config.subprojects?.length).toBeGreaterThanOrEqual(2);
  });
});
