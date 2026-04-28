import { describe, it, expect } from "vitest";
import { canTransition, isSafeBranchName } from "../src/pipeline.js";
import { PipelineState, defaultPipelineData } from "../src/types.js";

describe("canTransition — state machine", () => {
  it("allows IDLE → ARTEFACTOS", () => {
    expect(canTransition(PipelineState.IDLE, PipelineState.ARTEFACTOS).valid).toBe(true);
  });

  it("allows IDLE → TICKETS", () => {
    expect(canTransition(PipelineState.IDLE, PipelineState.TICKETS).valid).toBe(true);
  });

  it("rejects IDLE → PLAN (must go via TICKETS)", () => {
    const r = canTransition(PipelineState.IDLE, PipelineState.PLAN);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Transición ilegal");
  });

  it("rejects IDLE → IMPLEMENTACION", () => {
    expect(canTransition(PipelineState.IDLE, PipelineState.IMPLEMENTACION).valid).toBe(false);
  });

  it("allows ARTEFACTOS → TICKETS", () => {
    expect(canTransition(PipelineState.ARTEFACTOS, PipelineState.TICKETS).valid).toBe(true);
  });

  it("allows TICKETS → PLAN", () => {
    expect(canTransition(PipelineState.TICKETS, PipelineState.PLAN).valid).toBe(true);
  });

  it("rejects TICKETS → IMPLEMENTACION (must plan first)", () => {
    expect(canTransition(PipelineState.TICKETS, PipelineState.IMPLEMENTACION).valid).toBe(false);
  });

  it("allows PLAN → IMPLEMENTACION", () => {
    expect(canTransition(PipelineState.PLAN, PipelineState.IMPLEMENTACION).valid).toBe(true);
  });

  it("rejects PLAN → EVIDENCIA (must implement first)", () => {
    expect(canTransition(PipelineState.PLAN, PipelineState.EVIDENCIA).valid).toBe(false);
  });

  it("allows IMPLEMENTACION → EVIDENCIA", () => {
    expect(canTransition(PipelineState.IMPLEMENTACION, PipelineState.EVIDENCIA).valid).toBe(true);
  });

  it("rejects IMPLEMENTACION → COMMIT (must generate evidence first)", () => {
    expect(canTransition(PipelineState.IMPLEMENTACION, PipelineState.COMMIT).valid).toBe(false);
  });

  it("allows EVIDENCIA → COMMIT", () => {
    expect(canTransition(PipelineState.EVIDENCIA, PipelineState.COMMIT).valid).toBe(true);
  });

  it("allows COMMIT → COMPLETADO", () => {
    expect(canTransition(PipelineState.COMMIT, PipelineState.COMPLETADO).valid).toBe(true);
  });

  it("allows COMPLETADO → TICKETS (cycle to next ticket)", () => {
    expect(canTransition(PipelineState.COMPLETADO, PipelineState.TICKETS).valid).toBe(true);
  });

  it("rejects COMPLETADO → ARTEFACTOS (no going back)", () => {
    expect(canTransition(PipelineState.COMPLETADO, PipelineState.ARTEFACTOS).valid).toBe(false);
  });

  it("every non-IDLE state can return to IDLE", () => {
    const states = [
      PipelineState.ARTEFACTOS,
      PipelineState.TICKETS,
      PipelineState.PLAN,
      PipelineState.IMPLEMENTACION,
      PipelineState.EVIDENCIA,
      PipelineState.COMMIT,
      PipelineState.COMPLETADO,
    ];
    for (const s of states) {
      expect(canTransition(s, PipelineState.IDLE).valid).toBe(true);
    }
  });

  it("rejects same-state transitions (no self-loops)", () => {
    expect(canTransition(PipelineState.PLAN, PipelineState.PLAN).valid).toBe(false);
  });
});

describe("isSafeBranchName — input hardening for execFileSync", () => {
  it("accepts standard feature branch names", () => {
    expect(isSafeBranchName("feature/AUTH-45-login-google")).toBe(true);
    expect(isSafeBranchName("hotfix/PROD-99-fix-crash")).toBe(true);
    expect(isSafeBranchName("dev")).toBe(true);
    expect(isSafeBranchName("main")).toBe(true);
    expect(isSafeBranchName("release/v1.2.3")).toBe(true);
  });

  it("rejects empty and overly long names", () => {
    expect(isSafeBranchName("")).toBe(false);
    expect(isSafeBranchName("a".repeat(201))).toBe(false);
  });

  it("rejects shell metacharacters (the whole point)", () => {
    expect(isSafeBranchName("feature/x;rm -rf /")).toBe(false);
    expect(isSafeBranchName("feature/x`whoami`")).toBe(false);
    expect(isSafeBranchName("feature/x$(id)")).toBe(false);
    expect(isSafeBranchName("feature/x|cat")).toBe(false);
    expect(isSafeBranchName("feature/x && echo hi")).toBe(false);
    expect(isSafeBranchName("feature/x\nrm")).toBe(false);
  });

  it("rejects spaces and quotes", () => {
    expect(isSafeBranchName("feature with space")).toBe(false);
    expect(isSafeBranchName('feature/"quoted"')).toBe(false);
    expect(isSafeBranchName("feature/'quoted'")).toBe(false);
  });

  it("rejects path traversal attempts", () => {
    expect(isSafeBranchName("../../etc/passwd")).toBe(false);
    expect(isSafeBranchName("feature/../../escape")).toBe(false);
  });

  it("accepts dots in version-style branches", () => {
    expect(isSafeBranchName("v1.2.3")).toBe(true);
    expect(isSafeBranchName("release.candidate.1")).toBe(true);
  });
});

describe("defaultPipelineData — schema contract", () => {
  it("starts in IDLE with all per-ticket fields cleared", () => {
    const d = defaultPipelineData();
    expect(d.state).toBe(PipelineState.IDLE);
    expect(d.activeTicket).toBeNull();
    expect(d.tickets).toEqual([]);
    expect(d.featureBranch).toBeNull();
    expect(d.mergeRecord).toBeNull();
    expect(d.evidenceFilePath).toBeNull();
  });

  it("includes targetSubproject field initialized to null (multi-target schema)", () => {
    const d = defaultPipelineData();
    expect(d.targetSubproject).toBeNull();
  });

  it("includes gate flags initialized to false", () => {
    const d = defaultPipelineData();
    expect(d.awaitingUserConfirmation).toBe(false);
    expect(d.awaitingVerification).toBe(false);
    expect(d.sprintValidated).toBe(false);
  });
});
