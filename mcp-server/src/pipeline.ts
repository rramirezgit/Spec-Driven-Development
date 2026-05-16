import { readFile, writeFile, mkdir, rename, unlink, stat } from "node:fs/promises";
import { execSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PipelineState,
  VALID_TRANSITIONS,
  NEXT_ACTIONS,
  NEXT_COMMANDS,
  STATE_DESCRIPTIONS,
  defaultPipelineData,
} from "./types.js";
import type {
  PipelineData,
  LogEntry,
  TicketEntry,
  MergeType,
  DocsDecision,
  DocsDecisionStatus,
  DorValidation,
  DorStatus,
  ChangeDecision,
  RiskClassification,
  RiskLevel,
  AutoVerifyResult,
  AutoVerifyStatus,
  AutoVerifyTestCase,
  GoalSession,
  GoalMode,
  GoalTicketProgress,
  GoalTicketStatus,
} from "./types.js";
import { loadProjectConfig } from "./config.js";

const MAX_LOG_ENTRIES = 100;

// Resolve project root from the compiled JS location:
// dist/pipeline.js → dist/ → mcp-server/ → .ai-internal/ → PROJECT_ROOT
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..", "..");

const STATE_PATH = join(
  PROJECT_ROOT,
  ".ai-internal",
  "pipeline-state.json",
);

const CACHE_DIR = join(PROJECT_ROOT, ".ai-internal", ".cache");

/** Conservative sanitizer: only allow ticket IDs that look like tracker keys.
 *  Prevents path traversal via crafted ticket strings. */
function isSafeTicketId(id: string): boolean {
  if (!id || id.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(id);
}

export async function loadState(): Promise<PipelineData> {
  try {
    const content = await readFile(STATE_PATH, "utf-8");
    const data = JSON.parse(content) as PipelineData;
    // Validate state is a known enum value
    if (!Object.values(PipelineState).includes(data.state)) {
      console.error(
        `Warning: Unknown pipeline state "${data.state}" in ${STATE_PATH}, resetting to IDLE.`,
      );
      data.state = PipelineState.IDLE;
    }
    return data;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // File doesn't exist yet — expected on first run
      return defaultPipelineData();
    }
    // File exists but is corrupted or unreadable — warn explicitly
    console.error(
      `ERROR: Failed to load pipeline state from ${STATE_PATH}: ${(err as Error).message}. Resetting to IDLE. Previous state may be lost.`,
    );
    return defaultPipelineData();
  }
}

export async function saveState(data: PipelineData): Promise<void> {
  // Trim log to prevent unbounded growth
  if (data.log.length > MAX_LOG_ENTRIES) {
    data.log = data.log.slice(-MAX_LOG_ENTRIES);
  }

  await mkdir(dirname(STATE_PATH), { recursive: true });

  // Atomic write: write to temp file, then rename
  const tmpPath = STATE_PATH + ".tmp";
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmpPath, STATE_PATH);
}

export function canTransition(
  from: PipelineState,
  to: PipelineState,
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    const allowedStr = allowed?.join(", ") ?? "ninguno";
    return {
      valid: false,
      error: `Transición ilegal: ${from} → ${to}. Transiciones válidas desde ${from}: [${allowedStr}].`,
    };
  }
  return { valid: true };
}

export interface AdvanceResult {
  ok: boolean;
  from: PipelineState;
  to: PipelineState;
  error?: string;
}

export async function advance(
  to: PipelineState,
  change?: string,
): Promise<AdvanceResult> {
  const data = await loadState();
  const from = data.state;

  const check = canTransition(from, to);
  if (!check.valid) {
    return { ok: false, from, to, error: check.error };
  }

  // Gate: PLAN requires activeTicket (can't plan without selecting a ticket)
  if (to === PipelineState.PLAN && !data.activeTicket) {
    return {
      ok: false,
      from,
      to,
      error: "No se puede avanzar a PLAN sin un ticket activo. Usá sdd_set_active_ticket primero.",
    };
  }

  // Gate V4.18: PLAN requires DoR validation in strict mode.
  // In "warn" mode the validation is informative (no block).
  // In "off" mode the gate is inactive.
  if (to === PipelineState.PLAN) {
    const config = await loadProjectConfig();
    const dorMode = config?.dorEnforcement ?? "off";
    if (dorMode === "strict") {
      const v = data.dorValidation;
      const matchesActive = v && v.ticketId === data.activeTicket;
      const acceptable = matchesActive && (v.status === "passed" || v.status === "skipped");
      if (!acceptable) {
        return {
          ok: false,
          from,
          to,
          error:
            "⛔ DoR strict: no se puede avanzar a PLAN sin validación de Definition of Ready " +
            `para el ticket ${data.activeTicket}. ` +
            "Llamá sdd_validate_ticket_dor con el body actualizado del ticket. " +
            "Si el ticket es un hotfix legítimo, usá skip=true + skipReason='...' (≥10 chars).",
        };
      }
    }
  }

  // Gate: IMPLEMENTACION requires activeTicket (can't implement without a ticket)
  if (to === PipelineState.IMPLEMENTACION && !data.activeTicket) {
    return {
      ok: false,
      from,
      to,
      error: "No se puede avanzar a IMPLEMENTACION sin un ticket activo. Usá sdd_set_active_ticket primero.",
    };
  }

  // Gate: IMPLEMENTACION requires a feature branch (can't implement on main/dev)
  if (to === PipelineState.IMPLEMENTACION && !data.featureBranch) {
    return {
      ok: false,
      from,
      to,
      error:
        "⛔ No se puede implementar sin una rama feature creada. " +
        "Usá sdd_register_branch para registrar la rama feature/{TICKET_ID}-slug " +
        "ANTES de avanzar a IMPLEMENTACION. NUNCA implementar en main/dev directamente.",
    };
  }

  // Gate: IMPLEMENTACION en multi-target requiere targetSubproject seteado
  if (to === PipelineState.IMPLEMENTACION) {
    const config = await loadProjectConfig();
    if (config?.multiTargetMode && !data.targetSubproject) {
      const slugs = (config.subprojectSlugs ?? []).join(", ");
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ Proyecto en modo multi-target — falta target subproject. " +
          "Antes de implementar, llamá sdd_set_target_subproject(slug) con uno de: " +
          `[${slugs}]. Cada ticket apunta a UN solo subproyecto.`,
      };
    }
  }

  // Gate: IMPLEMENTACION → EVIDENCIA requires user verification
  if (from === PipelineState.IMPLEMENTACION && to === PipelineState.EVIDENCIA) {
    if (data.awaitingVerification) {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ No se puede generar evidencia sin verificación del usuario. " +
          "El usuario DEBE confirmar que la implementación funciona correctamente. " +
          "Mostrá los archivos modificados, preguntá con AskUserQuestion si funciona, " +
          "y llamá sdd_confirm_implementation cuando confirme.",
      };
    }

    // Gate V4.20: auto-verify enforced mode requires a result.
    // Acceptable: passed, inconclusive (degrade gracefully), skipped.
    // Failed → blocks. Result missing → blocks with guidance.
    const config = await loadProjectConfig();
    if (config?.autoVerify?.enabled && config.autoVerify.enforced) {
      const av = data.autoVerifyResult;
      if (!av) {
        return {
          ok: false,
          from,
          to,
          error:
            "⛔ Auto-verify enforced: no hay resultado registrado para el ticket activo. " +
            "Ejecutá /auto-verify y llamá sdd_register_auto_verification. " +
            "Si el dev server no está corriendo, /auto-verify reportará 'inconclusive' " +
            "lo cual SÍ permite avanzar (degrade gracefully).",
        };
      }
      if (av.status === "failed") {
        return {
          ok: false,
          from,
          to,
          error:
            `⛔ Auto-verify falló: ${av.reason}. ` +
            `Blockers: ${av.blockers.join("; ") || "(ver cases)"}. ` +
            "Corregí los issues y re-ejecutá /auto-verify antes de generar evidencia.",
        };
      }
    }
  }

  // Gate: EVIDENCIA → COMMIT requires evidence file registered
  if (from === PipelineState.EVIDENCIA && to === PipelineState.COMMIT) {
    if (!data.evidenceFilePath) {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ No se puede avanzar a COMMIT sin evidencia registrada. " +
          "Generá el archivo de evidencia (docs/evidence/{TICKET_ID}.md) y " +
          "registralo con sdd_register_evidence.",
      };
    }

    // Gate V4.16: EVIDENCIA → COMMIT requires a docs decision when Docusaurus is enabled.
    // The decision can be "updated" (docs were written) or "skipped" (with explicit reason).
    // This forces deliberate doc choices per ticket; never silent. The classifier is in
    // /update-docs and is intentionally conservative — most tickets land on "skipped".
    const config = await loadProjectConfig();
    if (config?.docusaurus?.enabled && !data.docsDecision) {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ No se puede avanzar a COMMIT sin decisión de docs registrada. " +
          "Docusaurus está habilitado en este proyecto. " +
          "Ejecutá /update-docs (clasificador conservador del diff) y registrá la decisión " +
          "con sdd_register_docs_decision. La decisión puede ser 'updated' (docs generados) " +
          "o 'skipped' con razón explícita (ej: 'refactor interno sin cambio de contratos').",
      };
    }
  }

  // Gate: COMMIT → COMPLETADO requires correct merge type registered
  if (from === PipelineState.COMMIT && to === PipelineState.COMPLETADO) {
    if (!data.mergeRecord) {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ No se puede completar sin registrar el merge. " +
          "Usá sdd_register_merge para registrar cómo se mergeó el código. " +
          "Feature branches: merge directo a dev (sin PR). " +
          "Hotfix branches: PR a main.",
      };
    }

    const branch = (data.featureBranch ?? "").toLowerCase();
    const isHotfix = branch.startsWith("hotfix/");
    const record = data.mergeRecord;

    if (!isHotfix && record.type === "pr") {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ Feature branches NO llevan PR. El flujo correcto es: " +
          "merge directo a dev (git merge, sin PR). " +
          "Los PR solo se crean en release (dev → main) o hotfix (→ main). " +
          "Usá sdd_register_merge con type='direct' y targetBranch='dev'.",
      };
    }

    if (!isHotfix) {
      const target = record.targetBranch.toLowerCase();
      if (target === "main" || target === "master") {
        return {
          ok: false,
          from,
          to,
          error:
            "⛔ Feature branches NUNCA van a main directamente. " +
            "El merge debe ir a dev/develop. " +
            "Main solo recibe código via /release-to-main (PR dev → main).",
        };
      }
    }

    if (isHotfix && record.type !== "pr") {
      return {
        ok: false,
        from,
        to,
        error:
          "⛔ Hotfix branches requieren PR a main (no merge directo). " +
          "Usá sdd_register_merge con type='pr' y targetBranch='main'.",
      };
    }
  }

  // Gate: COMPLETADO → TICKETS requires user confirmation via sdd_confirm_next
  if (
    from === PipelineState.COMPLETADO &&
    to === PipelineState.TICKETS &&
    data.awaitingUserConfirmation
  ) {
    return {
      ok: false,
      from,
      to,
      error:
        "⛔ No se puede continuar al siguiente ticket sin confirmación del usuario. " +
        "Llamá sdd_confirm_next DESPUÉS de que el usuario haya confirmado explícitamente " +
        "que quiere continuar. Usá AskUserQuestion para preguntarle.",
    };
  }

  data.state = to;
  if (change) data.change = change;

  // Set verification gate when entering IMPLEMENTACION
  if (to === PipelineState.IMPLEMENTACION) {
    data.awaitingVerification = true;
  }

  // Set confirmation gate when entering COMPLETADO
  if (to === PipelineState.COMPLETADO) {
    data.awaitingUserConfirmation = true;
  }

  // Capture previous ticket BEFORE resets so we can clear its diff cache.
  const previousTicket = data.activeTicket;

  // Reset when going back to IDLE (full reset)
  if (to === PipelineState.IDLE) {
    data.activeTicket = null;
    data.tickets = [];
    data.change = null;
    data.awaitingUserConfirmation = false;
    data.featureBranch = null;
    data.mergeRecord = null;
    data.awaitingVerification = false;
    data.sprintValidated = false;
    data.evidenceFilePath = null;
    data.targetSubproject = null;
    data.docsDecision = null;
    data.dorValidation = null;
    // V4.19: change-level data clears only at IDLE (persists across tickets).
    data.changeDecisions = [];
    data.changeRisk = null;
    data.ticketRisks = {};
    data.autoVerifyResult = null;
    data.goalSession = null;
    await clearDiffCacheForTicket(previousTicket);
  }

  // Reset per-ticket state when cycling back to TICKETS from COMPLETADO
  // (previous ticket is done, need to select a new one)
  if (to === PipelineState.TICKETS && from === PipelineState.COMPLETADO) {
    data.activeTicket = null;
    data.featureBranch = null;
    data.mergeRecord = null;
    data.awaitingVerification = false;
    data.sprintValidated = false;
    data.evidenceFilePath = null;
    data.targetSubproject = null;
    data.docsDecision = null;
    data.dorValidation = null;
    data.autoVerifyResult = null;
    await clearDiffCacheForTicket(previousTicket);
  }

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "ADVANCE",
    from,
    to,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, from, to };
}

export interface RegisterTicketsResult {
  ok: boolean;
  count: number;
  totalTickets: number;
  error?: string;
}

export async function registerTickets(
  tickets: TicketEntry[],
): Promise<RegisterTicketsResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.TICKETS &&
    data.state !== PipelineState.ARTEFACTOS
  ) {
    return {
      ok: false,
      count: 0,
      totalTickets: data.tickets.length,
      error: `Solo se pueden registrar tickets en estado ARTEFACTOS o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  // Append + deduplicate by ID (new tickets override existing ones with same ID)
  const existingMap = new Map(data.tickets.map((t) => [t.id, t]));
  for (const ticket of tickets) {
    existingMap.set(ticket.id, ticket);
  }
  data.tickets = Array.from(existingMap.values());

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_TICKETS",
    count: tickets.length,
    detail: `Added: ${tickets.map((t) => t.id).join(", ")}. Total: ${data.tickets.length}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, count: tickets.length, totalTickets: data.tickets.length };
}

export interface SetActiveTicketResult {
  ok: boolean;
  ticket?: TicketEntry;
  error?: string;
}

const VALID_STATES_FOR_SET_ACTIVE = [
  PipelineState.TICKETS,
  PipelineState.PLAN,
];

export async function setActiveTicket(
  ticketId: string,
): Promise<SetActiveTicketResult> {
  const data = await loadState();

  // Validate pipeline state
  if (!VALID_STATES_FOR_SET_ACTIVE.includes(data.state)) {
    return {
      ok: false,
      error: `Solo se puede activar un ticket en estado TICKETS o PLAN. Estado actual: ${data.state}.`,
    };
  }

  // Sprint Gate: require sprint validation before activating ticket
  if (!data.sprintValidated) {
    return {
      ok: false,
      error:
        "⛔ Sprint Gate: no se puede activar un ticket sin validar el sprint. " +
        "Primero verificá que el ticket esté en un sprint activo usando getJiraIssue, " +
        "luego llamá sdd_confirm_sprint. Si el proyecto es Kanban (sin sprints), " +
        "llamá sdd_confirm_sprint(kanban=true) para bypass.",
    };
  }

  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    const ids = data.tickets.map((t) => t.id).join(", ");
    return {
      ok: false,
      error: `Ticket "${ticketId}" no encontrado en la lista registrada. Tickets disponibles: [${ids}].`,
    };
  }

  data.activeTicket = ticketId;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "SET_ACTIVE_TICKET",
    detail: ticketId,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, ticket };
}

// ─── Branch registration ────────────────────────────────────────────────────

export interface RegisterBranchResult {
  ok: boolean;
  branch?: string;
  error?: string;
}

const FEATURE_BRANCH_PATTERN = /^(feature|hotfix|bugfix)\/.+/;
const FORBIDDEN_BRANCHES = ["main", "master", "dev", "develop", "staging", "production"];

export async function registerBranch(
  branchName: string,
): Promise<RegisterBranchResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.PLAN &&
    data.state !== PipelineState.TICKETS
  ) {
    return {
      ok: false,
      error: `Solo se puede registrar una rama en estado PLAN o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  // Reject direct work on protected branches
  const normalized = branchName.toLowerCase().trim();
  if (FORBIDDEN_BRANCHES.includes(normalized)) {
    return {
      ok: false,
      error:
        `⛔ Rama "${branchName}" es una rama protegida. ` +
        "Creá una rama feature/{TICKET_ID}-slug para trabajar. " +
        "NUNCA se implementa en main, dev, master o develop directamente.",
    };
  }

  // Validate branch name follows convention
  if (!FEATURE_BRANCH_PATTERN.test(normalized)) {
    return {
      ok: false,
      error:
        `⛔ Rama "${branchName}" no sigue la convención. ` +
        "Las ramas deben seguir el patrón: feature/{TICKET_ID}-slug, hotfix/{TICKET_ID}-slug, o bugfix/{TICKET_ID}-slug.",
    };
  }

  // Verify the branch actually exists in git
  try {
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();
    if (currentBranch !== branchName) {
      return {
        ok: false,
        error:
          `⛔ La rama actual es "${currentBranch}" pero intentás registrar "${branchName}". ` +
          "Creá la rama primero (git checkout -b) y asegurate de estar parado en ella.",
      };
    }
  } catch {
    // git not available — skip verification (CI environment, etc.)
  }

  data.featureBranch = branchName;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_BRANCH",
    detail: branchName,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, branch: branchName };
}

// ─── Implementation verification ─────────────────────────────────────────────

export interface ConfirmImplementationResult {
  ok: boolean;
  error?: string;
}

export async function confirmImplementation(): Promise<ConfirmImplementationResult> {
  const data = await loadState();

  if (data.state !== PipelineState.IMPLEMENTACION) {
    return {
      ok: false,
      error: `Solo se puede confirmar implementación en estado IMPLEMENTACION. Estado actual: ${data.state}.`,
    };
  }

  if (!data.awaitingVerification) {
    return {
      ok: false,
      error: "No hay verificación pendiente.",
    };
  }

  data.awaitingVerification = false;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "USER_VERIFIED_IMPLEMENTATION",
    detail: `User confirmed implementation works for ticket ${data.activeTicket}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true };
}

// ─── Sprint validation ───────────────────────────────────────────────────────

export interface ConfirmSprintResult {
  ok: boolean;
  error?: string;
}

export async function confirmSprint(
  kanban: boolean,
): Promise<ConfirmSprintResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.TICKETS &&
    data.state !== PipelineState.PLAN
  ) {
    return {
      ok: false,
      error: `Solo se puede validar sprint en estado TICKETS o PLAN. Estado actual: ${data.state}.`,
    };
  }

  data.sprintValidated = true;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "SPRINT_VALIDATED",
    detail: kanban
      ? "Kanban project — sprint gate bypassed."
      : "Sprint validated as active via Jira.",
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true };
}

// ─── Evidence registration ───────────────────────────────────────────────────

export interface RegisterEvidenceResult {
  ok: boolean;
  error?: string;
}

export async function registerEvidence(
  filePath: string,
): Promise<RegisterEvidenceResult> {
  const data = await loadState();

  if (data.state !== PipelineState.EVIDENCIA) {
    return {
      ok: false,
      error: `Solo se puede registrar evidencia en estado EVIDENCIA. Estado actual: ${data.state}.`,
    };
  }

  // Verify the evidence file actually exists on disk
  const fullPath = join(PROJECT_ROOT, filePath);
  try {
    await readFile(fullPath, "utf-8");
  } catch {
    return {
      ok: false,
      error: `⛔ El archivo de evidencia no existe: ${filePath}. Generá el archivo primero con /evidence.`,
    };
  }

  data.evidenceFilePath = filePath;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_EVIDENCE",
    detail: `Evidence file registered: ${filePath} for ticket ${data.activeTicket}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true };
}

/**
 * Conservative validator for git branch names — rejects anything that could
 * inject shell or git-ref tricks. Git allows more characters in theory; this
 * is intentionally stricter to limit attack surface.
 */
export function isSafeBranchName(name: string): boolean {
  if (!name || name.length > 200) return false;
  // Reject ".." segments (defense-in-depth even though execFileSync is shell-free).
  if (name.includes("..")) return false;
  return /^[A-Za-z0-9._/-]+$/.test(name);
}

// ─── Diff cache (V4.17 — token-saving) ──────────────────────────────────────

export interface CacheDiffResult {
  ok: boolean;
  path?: string;
  metaPath?: string;
  headSha?: string;
  baseSha?: string;
  sizeBytes?: number;
  cached?: boolean; // true if we reused an existing cache; false if we regenerated
  error?: string;
}

/**
 * Caches `git diff base...HEAD` for the active ticket on disk so multiple
 * commands (/evidence, /update-docs, /commit, future /auto-verify) read the
 * same diff once instead of re-running git per invocation.
 *
 * Cache key is the ticket ID + HEAD sha. If HEAD moves (new commit on the
 * branch), the cache is regenerated automatically. If the ticket changes
 * (next cycle), `clearDiffCacheForTicket()` is called by advance() on the
 * IDLE/COMPLETADO transitions.
 *
 * Returns:
 *   - path: where the diff content was written
 *   - metaPath: companion .meta.json with { headSha, baseSha, ticket, createdAt }
 *   - cached: true if reused, false if regenerated
 */
export async function cacheDiff(): Promise<CacheDiffResult> {
  const data = await loadState();

  if (!data.activeTicket) {
    return {
      ok: false,
      error: "No hay ticket activo. Llamá sdd_set_active_ticket antes de cachear diff.",
    };
  }

  if (!isSafeTicketId(data.activeTicket)) {
    return {
      ok: false,
      error: `Ticket ID inválido para cache: "${data.activeTicket}". Solo se permiten letras, números, guion y guion-bajo.`,
    };
  }

  let headSha: string;
  let baseSha: string;
  try {
    headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();
    // Use merge-base with the dev branch if registered, else main as fallback
    const baseBranch = data.featureBranch ? "main" : "main";
    baseSha = execFileSync("git", ["merge-base", baseBranch, "HEAD"], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();
  } catch (err) {
    return {
      ok: false,
      error: `No se pudo resolver HEAD/base sha vía git: ${(err as Error).message}`,
    };
  }

  const ticketId = data.activeTicket;
  const diffPath = join(CACHE_DIR, `diff-${ticketId}.txt`);
  const metaPath = join(CACHE_DIR, `diff-${ticketId}.meta.json`);

  // Reuse existing cache if HEAD sha matches
  try {
    const metaRaw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaRaw) as { headSha: string; baseSha: string };
    if (meta.headSha === headSha && meta.baseSha === baseSha) {
      const st = await stat(diffPath);
      return {
        ok: true,
        path: diffPath,
        metaPath,
        headSha,
        baseSha,
        sizeBytes: st.size,
        cached: true,
      };
    }
  } catch {
    // No cache yet, or unreadable — regenerate below
  }

  // Regenerate cache
  let diffContent: string;
  try {
    diffContent = execFileSync(
      "git",
      ["diff", `${baseSha}...HEAD`],
      { cwd: PROJECT_ROOT, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (err) {
    return {
      ok: false,
      error: `git diff falló: ${(err as Error).message}`,
    };
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(diffPath, diffContent, "utf-8");
  await writeFile(
    metaPath,
    JSON.stringify(
      {
        ticket: ticketId,
        headSha,
        baseSha,
        createdAt: new Date().toISOString(),
        sizeBytes: Buffer.byteLength(diffContent, "utf-8"),
      },
      null,
      2,
    ),
    "utf-8",
  );

  return {
    ok: true,
    path: diffPath,
    metaPath,
    headSha,
    baseSha,
    sizeBytes: Buffer.byteLength(diffContent, "utf-8"),
    cached: false,
  };
}

/** Removes the cache for a specific ticket (best-effort, errors swallowed). */
async function clearDiffCacheForTicket(ticketId: string | null | undefined): Promise<void> {
  if (!ticketId || !isSafeTicketId(ticketId)) return;
  const diffPath = join(CACHE_DIR, `diff-${ticketId}.txt`);
  const metaPath = join(CACHE_DIR, `diff-${ticketId}.meta.json`);
  await unlink(diffPath).catch(() => {});
  await unlink(metaPath).catch(() => {});
}

// ─── Goal session (V4.21 — batch supervisado) ───────────────────────────────

export interface RegisterGoalResult {
  ok: boolean;
  session?: GoalSession;
  error?: string;
}

const MAX_GOAL_TICKETS = 30;

export async function registerGoal(
  tickets: string[],
  mode: GoalMode,
): Promise<RegisterGoalResult> {
  const data = await loadState();

  // Solo arrancar batch desde TICKETS o IDLE (sin pipeline activo)
  if (
    data.state !== PipelineState.TICKETS &&
    data.state !== PipelineState.IDLE
  ) {
    return {
      ok: false,
      error: `Solo se puede iniciar un /goal en estado IDLE o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  if (data.goalSession && !data.goalSession.finishedAt && !data.goalSession.aborted) {
    return {
      ok: false,
      error:
        "⛔ Ya hay una sesión de /goal activa con " +
        `${Object.keys(data.goalSession.progress).length} tickets. ` +
        "Terminala (todos los tickets resueltos o aborted) antes de iniciar una nueva.",
    };
  }

  if (tickets.length === 0) {
    return {
      ok: false,
      error: "⛔ Lista de tickets vacía.",
    };
  }
  if (tickets.length > MAX_GOAL_TICKETS) {
    return {
      ok: false,
      error: `⛔ Demasiados tickets (${tickets.length}). Máximo ${MAX_GOAL_TICKETS} por batch — partilo en lotes.`,
    };
  }

  // Validar todos los IDs (sanitización)
  const seen = new Set<string>();
  for (const t of tickets) {
    if (!isSafeTicketId(t)) {
      return {
        ok: false,
        error: `⛔ Ticket ID inválido: "${t}". Solo letras, números, guion y guion-bajo.`,
      };
    }
    if (seen.has(t)) {
      return {
        ok: false,
        error: `⛔ Ticket "${t}" aparece duplicado en la lista.`,
      };
    }
    seen.add(t);
  }

  const now = new Date().toISOString();
  const progress: Record<string, GoalTicketProgress> = {};
  for (const t of tickets) {
    progress[t] = { ticketId: t, status: "pending" };
  }

  const session: GoalSession = {
    tickets,
    mode,
    progress,
    startedAt: now,
    finishedAt: null,
    aborted: false,
  };
  data.goalSession = session;
  data.log.push({
    timestamp: now,
    action: "REGISTER_GOAL",
    detail: `Goal session iniciada: mode=${mode}, ${tickets.length} tickets: ${tickets.join(", ")}.`,
  });
  await saveState(data);
  return { ok: true, session };
}

export interface UpdateGoalProgressResult {
  ok: boolean;
  remaining?: number;
  done?: number;
  error?: string;
}

export async function updateGoalProgress(
  ticketId: string,
  status: GoalTicketStatus,
  reason?: string,
  autoVerify?: AutoVerifyStatus,
): Promise<UpdateGoalProgressResult> {
  const data = await loadState();
  if (!data.goalSession) {
    return {
      ok: false,
      error: "⛔ No hay goal session activa. Llamá sdd_register_goal primero.",
    };
  }
  if (data.goalSession.aborted || data.goalSession.finishedAt) {
    return {
      ok: false,
      error: "⛔ La goal session ya terminó. Iniciá una nueva con sdd_register_goal.",
    };
  }

  if (!isSafeTicketId(ticketId)) {
    return {
      ok: false,
      error: `⛔ Ticket ID inválido: "${ticketId}".`,
    };
  }

  if (!data.goalSession.progress[ticketId]) {
    return {
      ok: false,
      error: `⛔ Ticket "${ticketId}" no está en el batch. Tickets del batch: ${data.goalSession.tickets.join(", ")}.`,
    };
  }

  const now = new Date().toISOString();
  const entry = data.goalSession.progress[ticketId];
  const prev = entry.status;
  entry.status = status;
  if (reason !== undefined) entry.reason = reason.slice(0, 280);
  if (autoVerify) entry.autoVerify = autoVerify;
  if (status === "in_progress" && !entry.startedAt) entry.startedAt = now;
  if (
    (status === "completed" || status === "failed" || status === "skipped") &&
    !entry.finishedAt
  ) {
    entry.finishedAt = now;
  }

  data.log.push({
    timestamp: now,
    action: "GOAL_PROGRESS",
    detail: `${ticketId}: ${prev} → ${status}${reason ? ` (${reason})` : ""}`,
  });

  // Si todos los tickets están en estado terminal → cerrar la sesión.
  const allDone = Object.values(data.goalSession.progress).every((p) =>
    ["completed", "failed", "skipped"].includes(p.status),
  );
  if (allDone) {
    data.goalSession.finishedAt = now;
    data.log.push({
      timestamp: now,
      action: "GOAL_FINISHED",
      detail: `Goal batch completo. ${Object.values(data.goalSession.progress).filter((p) => p.status === "completed").length} ok / ${Object.values(data.goalSession.progress).filter((p) => p.status === "failed").length} failed / ${Object.values(data.goalSession.progress).filter((p) => p.status === "skipped").length} skipped.`,
    });
  }

  const done = Object.values(data.goalSession.progress).filter((p) =>
    ["completed", "failed", "skipped"].includes(p.status),
  ).length;
  const remaining = data.goalSession.tickets.length - done;

  await saveState(data);
  return { ok: true, remaining, done };
}

export interface AbortGoalResult {
  ok: boolean;
  error?: string;
}

export async function abortGoal(reason: string): Promise<AbortGoalResult> {
  const data = await loadState();
  if (!data.goalSession) {
    return { ok: false, error: "⛔ No hay goal session activa." };
  }
  const trimmed = (reason ?? "").trim();
  if (!trimmed || trimmed.length < 5) {
    return {
      ok: false,
      error: "⛔ Razón obligatoria (≥5 chars). Ej: 'usuario abortó', 'pre-flight fail crítico'.",
    };
  }
  const now = new Date().toISOString();
  data.goalSession.aborted = true;
  data.goalSession.abortReason = trimmed.slice(0, 280);
  data.goalSession.finishedAt = now;
  data.log.push({
    timestamp: now,
    action: "GOAL_ABORTED",
    detail: trimmed,
  });
  await saveState(data);
  return { ok: true };
}

// ─── Auto-verify registration (V4.20) ───────────────────────────────────────

export interface RegisterAutoVerifyResult {
  ok: boolean;
  result?: AutoVerifyResult;
  error?: string;
}

const MAX_AV_CASES = 50;
const MAX_AV_DETAIL_LEN = 200;
const MAX_AV_REASON_LEN = 280;

export async function registerAutoVerification(
  status: AutoVerifyStatus,
  reason: string,
  cases: Array<{
    trigger: string;
    description: string;
    outcome: "passed" | "failed" | "inconclusive";
    detail?: string;
  }>,
  blockers: string[],
): Promise<RegisterAutoVerifyResult> {
  const data = await loadState();

  // Only valid during IMPLEMENTACION (after dev finished writing code).
  if (data.state !== PipelineState.IMPLEMENTACION) {
    return {
      ok: false,
      error: `Solo se puede registrar auto-verify en estado IMPLEMENTACION. Estado actual: ${data.state}.`,
    };
  }

  const trimmedReason = (reason ?? "").trim();
  if (!trimmedReason) {
    return {
      ok: false,
      error: "⛔ La razón global es obligatoria. Ej: 'todos los smokes pasaron', 'dev server no respondió'.",
    };
  }
  if (trimmedReason.length > MAX_AV_REASON_LEN) {
    return {
      ok: false,
      error: `⛔ La razón excede ${MAX_AV_REASON_LEN} caracteres. Resumila.`,
    };
  }

  if (cases.length > MAX_AV_CASES) {
    return {
      ok: false,
      error: `⛔ Demasiados casos (${cases.length}). Máximo ${MAX_AV_CASES} — un ticket no debería tener más smokes que eso.`,
    };
  }

  // Sanity: failed → debe haber al menos un caso failed o al menos un blocker
  if (status === "failed") {
    const anyFailed = cases.some((c) => c.outcome === "failed");
    if (!anyFailed && blockers.length === 0) {
      return {
        ok: false,
        error:
          "⛔ status='failed' requiere al menos un case con outcome='failed' " +
          "o al menos un blocker listado. Si no hay falla concreta, usá " +
          "'inconclusive' con razón.",
      };
    }
  }

  // Sanity: passed → no debe haber failed cases
  if (status === "passed") {
    const anyFailed = cases.some((c) => c.outcome === "failed");
    if (anyFailed) {
      return {
        ok: false,
        error:
          "⛔ status='passed' es inconsistente: hay cases con outcome='failed'. " +
          "Usá 'failed' como status global.",
      };
    }
  }

  const cleanedCases: AutoVerifyTestCase[] = [];
  for (const c of cases) {
    const trig = (c.trigger ?? "").trim();
    const desc = (c.description ?? "").trim();
    if (!trig || !desc) {
      return {
        ok: false,
        error: "⛔ Cada case requiere trigger y description no vacíos.",
      };
    }
    let detail = (c.detail ?? "").trim();
    if (detail.length > MAX_AV_DETAIL_LEN) {
      detail = detail.slice(0, MAX_AV_DETAIL_LEN) + "…";
    }
    cleanedCases.push({
      trigger: trig,
      description: desc,
      outcome: c.outcome,
      detail: detail || undefined,
    });
  }

  const cleanedBlockers = (blockers ?? [])
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 20);

  const result: AutoVerifyResult = {
    status,
    reason: trimmedReason,
    cases: cleanedCases,
    blockers: cleanedBlockers,
    timestamp: new Date().toISOString(),
  };
  data.autoVerifyResult = result;
  data.log.push({
    timestamp: result.timestamp,
    action: "REGISTER_AUTO_VERIFY",
    detail:
      `Ticket ${data.activeTicket}: ${status} — ${trimmedReason}. ` +
      `Cases: ${cleanedCases.length} (${cleanedCases.filter((c) => c.outcome === "passed").length} ok / ${cleanedCases.filter((c) => c.outcome === "failed").length} fail / ${cleanedCases.filter((c) => c.outcome === "inconclusive").length} inc). ` +
      `Blockers: ${cleanedBlockers.length}.`,
  });
  await saveState(data);
  return { ok: true, result };
}

// ─── Change decisions + risk classification (V4.19) ─────────────────────────

/** Pure heuristic: classify a set of paths/keywords into low/medium/high risk.
 *  Used during menu Opción 1 (change-level) and during /create-tickets
 *  (per-ticket). Designed to be conservative — false positives (high-classify
 *  something benign) are recoverable; false negatives (auto-merge auth bug)
 *  are not. */

/** Path/keyword tokens that ALWAYS trigger HIGH risk regardless of context.
 *  Match is substring + lowercase. Order doesn't matter; first hit wins for
 *  reason reporting. */
const HIGH_RISK_TOKENS = [
  "auth/",
  "oauth/",
  "session/",
  "/jwt",
  "/token",
  "payment",
  "billing",
  "invoice",
  "subscription",
  "migration",
  "prisma/migrations",
  "schema.prisma",
  "secrets/",
  ".env.production",
  "crypto/",
  "encryption/",
  "/cron",
  "scheduler/",
  "worker/",
  "iam/",
  "rbac/",
  "permissions/",
  "webhook",
];

const MEDIUM_RISK_TOKENS = [
  "api/",
  "routes/",
  "controllers/",
  "handlers/",
  "resolvers/",
  "components/",
  "screens/",
  "pages/",
  "hooks/",
  "services/",
  "store/",
  "reducers/",
];

/** Keywords (not paths) that bump risk by one notch when found in descriptions. */
const HIGH_RISK_KEYWORDS = [
  "breaking",
  "rotation",
  "expire",
  "revoke",
  "ratelimit",
  "rate-limit",
  "delete\\s+all",
  "drop\\s+table",
  "truncate",
  "mass\\s+update",
  "backfill",
  "production",
];

export interface RiskClassifyInput {
  /** Paths the change/ticket is expected to touch (relative to repo root). */
  paths?: string[];
  /** Free-text descriptor (ticket body, plan, change description). */
  description?: string;
}

export interface RiskClassifyOutput {
  level: RiskLevel;
  reasons: string[];
}

export function classifyRisk(input: RiskClassifyInput): RiskClassifyOutput {
  const reasons: string[] = [];
  const pathsLower = (input.paths ?? []).map((p) => p.toLowerCase());
  const descLower = (input.description ?? "").toLowerCase();

  // HIGH triggers
  for (const tok of HIGH_RISK_TOKENS) {
    const tokenL = tok.toLowerCase();
    if (pathsLower.some((p) => p.includes(tokenL))) {
      reasons.push(`Path matches high-risk token "${tok}"`);
    }
  }
  for (const kw of HIGH_RISK_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(descLower)) {
      reasons.push(`Description mentions high-risk concept "${kw}"`);
    }
  }
  if (reasons.length > 0) {
    return { level: "high", reasons };
  }

  // MEDIUM triggers
  for (const tok of MEDIUM_RISK_TOKENS) {
    if (pathsLower.some((p) => p.includes(tok.toLowerCase()))) {
      reasons.push(`Path matches medium-risk token "${tok}"`);
    }
  }
  if (reasons.length > 0) {
    return { level: "medium", reasons };
  }

  // Default
  return {
    level: "low",
    reasons: ["Sin paths o keywords que disparen medium/high"],
  };
}

// ─── Change decisions registration ──────────────────────────────────────────

export interface RegisterChangeDecisionsResult {
  ok: boolean;
  totalDecisions: number;
  error?: string;
}

const MAX_DECISIONS_PER_CHANGE = 25;
const MAX_DECISION_LEN = 500; // chars per Q or A

export async function registerChangeDecisions(
  decisions: Array<{
    question: string;
    answer: string;
    affectsTickets?: string[];
  }>,
): Promise<RegisterChangeDecisionsResult> {
  const data = await loadState();

  // Only valid during ARTEFACTOS (gap analysis happens before tickets exist).
  // Also allow TICKETS for late corrections (during /refine-ticket).
  if (
    data.state !== PipelineState.ARTEFACTOS &&
    data.state !== PipelineState.TICKETS
  ) {
    return {
      ok: false,
      totalDecisions: data.changeDecisions?.length ?? 0,
      error: `Solo se pueden registrar decisiones en estado ARTEFACTOS o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  if (decisions.length === 0) {
    return {
      ok: false,
      totalDecisions: data.changeDecisions?.length ?? 0,
      error: "⛔ Lista de decisiones vacía. Pasá al menos una decisión {question, answer}.",
    };
  }

  const existing = data.changeDecisions ?? [];
  if (existing.length + decisions.length > MAX_DECISIONS_PER_CHANGE) {
    return {
      ok: false,
      totalDecisions: existing.length,
      error: `⛔ Demasiadas decisiones (${existing.length + decisions.length}). Máximo ${MAX_DECISIONS_PER_CHANGE} por change.`,
    };
  }

  const now = new Date().toISOString();
  const cleaned: ChangeDecision[] = [];
  for (const d of decisions) {
    const q = (d.question ?? "").trim();
    const a = (d.answer ?? "").trim();
    if (!q || !a) {
      return {
        ok: false,
        totalDecisions: existing.length,
        error: "⛔ Cada decisión requiere question y answer no vacíos.",
      };
    }
    if (q.length > MAX_DECISION_LEN || a.length > MAX_DECISION_LEN) {
      return {
        ok: false,
        totalDecisions: existing.length,
        error: `⛔ question o answer excede ${MAX_DECISION_LEN} chars. Resumí.`,
      };
    }
    cleaned.push({
      question: q,
      answer: a,
      affectsTickets: d.affectsTickets?.length ? d.affectsTickets : undefined,
      timestamp: now,
    });
  }

  data.changeDecisions = [...existing, ...cleaned];
  data.log.push({
    timestamp: now,
    action: "REGISTER_CHANGE_DECISIONS",
    detail: `${cleaned.length} decisiones registradas. Total: ${data.changeDecisions.length}.`,
  });
  await saveState(data);
  return { ok: true, totalDecisions: data.changeDecisions.length };
}

// ─── Risk classification registration ───────────────────────────────────────

export interface RegisterRiskResult {
  ok: boolean;
  scope: "change" | "ticket";
  level?: RiskLevel;
  error?: string;
}

export async function registerRisk(
  scope: "change" | "ticket",
  ticketId: string | undefined,
  classification: RiskClassifyOutput,
): Promise<RegisterRiskResult> {
  const data = await loadState();
  const now = new Date().toISOString();
  const rc: RiskClassification = {
    level: classification.level,
    reasons: classification.reasons.slice(0, 10), // cap reasons
    timestamp: now,
  };

  if (scope === "change") {
    if (
      data.state === PipelineState.IDLE ||
      data.state === PipelineState.COMPLETADO
    ) {
      return {
        ok: false,
        scope,
        error: `Risk de change solo se puede registrar entre ARTEFACTOS y COMMIT. Estado actual: ${data.state}.`,
      };
    }
    data.changeRisk = rc;
    data.log.push({
      timestamp: now,
      action: "REGISTER_CHANGE_RISK",
      detail: `Change risk: ${rc.level}. Reasons: ${rc.reasons.join("; ")}.`,
    });
  } else {
    if (!ticketId) {
      return {
        ok: false,
        scope,
        error: "⛔ scope=ticket requiere ticketId.",
      };
    }
    if (!isSafeTicketId(ticketId)) {
      return {
        ok: false,
        scope,
        error: `⛔ ticketId inválido: "${ticketId}".`,
      };
    }
    data.ticketRisks = data.ticketRisks ?? {};
    data.ticketRisks[ticketId] = rc;
    data.log.push({
      timestamp: now,
      action: "REGISTER_TICKET_RISK",
      detail: `Ticket ${ticketId} risk: ${rc.level}.`,
    });
  }

  await saveState(data);
  return { ok: true, scope, level: rc.level };
}

// ─── Definition of Ready validator (V4.18) ──────────────────────────────────

/**
 * Validates a ticket body against the V4.18 schema. Pure function — does NOT
 * read state or touch disk. The caller (an agent that fetched the ticket from
 * Jira/Notion) passes the markdown body; the validator returns structured
 * errors + warnings.
 *
 * Design intent:
 *  - "errors" block PLAN transition when dorEnforcement="strict".
 *  - "warnings" are advisory; never block.
 *  - The detector is LENIENT on section headers (matches H1-H4 or bold) and
 *    accepts both Spanish and English titles. Same for content.
 *  - The vague-words list is intentionally short to avoid false positives.
 */
export interface SectionPresence {
  present: boolean;
  count?: number;
  vagueMatches?: string[];
}

export interface DorValidationDetail {
  ok: boolean;
  errors: string[];
  warnings: string[];
  sections: {
    objetivo: SectionPresence;
    contextoTecnico: SectionPresence;
    criteriosAceptacion: SectionPresence;
    fueraDeScope: SectionPresence;
    dependencias: SectionPresence;
    riesgos: SectionPresence;
    testCases: SectionPresence;
    definitionOfDone: SectionPresence;
  };
}

/** Section title regex — matches headers (H1-H4) or bold-line patterns. */
const SECTION_PATTERNS: Record<keyof DorValidationDetail["sections"], RegExp> = {
  objetivo:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Objetivo|Goal|Objective)\b/i,
  contextoTecnico:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Contexto\s+t[ée]cnico|Technical\s+context|Detalle\s+t[ée]cnico)\b/i,
  criteriosAceptacion:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Criterios?\s+de\s+aceptaci[óo]n|Acceptance\s+criteria)\b/i,
  fueraDeScope:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Fuera\s+de(?:l)?\s+scope|Fuera\s+de\s+alcance|Out\s+of\s+scope|Non\s*-?\s*goals)\b/i,
  dependencias:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Dependencias?|Dependencies)\b/i,
  riesgos:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Riesgos?|Consideraciones?|Risks?|Considerations?)\b/i,
  testCases:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Test\s+cases?|Casos\s+de\s+(?:test|prueba)|Tests?\s+declarados?)\b/i,
  definitionOfDone:
    /(?:^|\n)\s*(?:#{1,4}\s*|\*\*)(?:Definition\s+of\s+Done|DoD|Criterios?\s+de\s+finalizaci[óo]n)\b/i,
};

const SECTION_ORDER: (keyof DorValidationDetail["sections"])[] = [
  "objetivo",
  "contextoTecnico",
  "criteriosAceptacion",
  "fueraDeScope",
  "dependencias",
  "riesgos",
  "testCases",
  "definitionOfDone",
];

/** Vague words that disqualify acceptance criteria when they appear without
 *  an accompanying metric. Kept short on purpose — false positives kill trust. */
const VAGUE_PATTERNS: RegExp[] = [
  /\bcorrectamente\b/i,
  /\bapropiadamente\b/i,
  /\bintuitiv[oa]\b/i,
  /\buser[\s-]?friendly\b/i,
  /\bworks?\s+correctly\b/i,
  /\bproperly\b/i,
  /\bintuitive(?:ly)?\b/i,
  /\beasy[\s-]?to[\s-]?use\b/i,
];

/** Empty/placeholder phrases that disqualify an "Out of scope" section. */
const EMPTY_OOS_PHRASES: RegExp[] = [
  /^\s*-?\s*(?:nada|ninguno|ninguna|n\/a|na|none)\s*\.?\s*$/im,
];

/** Extracts the slice between a section header and the next H1-H4 / bold header. */
function extractSection(body: string, headerRegex: RegExp): string | null {
  const start = headerRegex.exec(body);
  if (!start) return null;
  const remainder = body.slice(start.index + start[0].length);
  // Stop at the next section header (any H1-H4 or bold-line pattern)
  const nextHeader = /\n\s*(?:#{1,4}\s+|\*\*[^\n]+\*\*\s*\n)/.exec(remainder);
  return nextHeader ? remainder.slice(0, nextHeader.index) : remainder;
}

/** Counts bulleted/check-listed items (- foo, * foo, 1. foo, - [ ] foo). */
function countListItems(section: string): number {
  const lines = section.split("\n");
  let count = 0;
  for (const line of lines) {
    if (/^\s*(?:[-*+]|\d+\.)\s+\S/.test(line)) count++;
  }
  return count;
}

export function validateTicketDor(body: string): DorValidationDetail {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sections = {} as DorValidationDetail["sections"];

  for (const key of SECTION_ORDER) {
    const pattern = SECTION_PATTERNS[key];
    const slice = extractSection(body, pattern);
    sections[key] = { present: slice !== null };

    if (slice === null) {
      errors.push(`Sección obligatoria ausente: "${humanLabel(key)}".`);
      continue;
    }

    const items = countListItems(slice);
    sections[key].count = items;

    // Per-section rules
    if (key === "criteriosAceptacion") {
      if (items < 2) {
        errors.push(
          `"Criterios de aceptación" debe tener al menos 2 items (encontrados: ${items}).`,
        );
      }
      const vague: string[] = [];
      for (const re of VAGUE_PATTERNS) {
        const m = slice.match(re);
        if (m) vague.push(m[0]);
      }
      sections[key].vagueMatches = vague;
      if (vague.length > 0) {
        warnings.push(
          `Criterios contienen lenguaje vago sin métrica: [${vague.join(", ")}]. ` +
            "Reformulá con condiciones observables/medibles.",
        );
      }
    }

    if (key === "fueraDeScope") {
      if (items === 0) {
        errors.push(
          "\"Fuera de scope\" debe tener al menos 1 ítem explícito. " +
            "Si nada queda fuera, el ticket probablemente es demasiado grande.",
        );
      } else {
        const hasEmptyPhrase = EMPTY_OOS_PHRASES.some((re) => re.test(slice));
        if (hasEmptyPhrase) {
          errors.push(
            "\"Fuera de scope\" contiene 'nada/ninguno/N/A'. " +
              "Listá items explícitos o partí el ticket.",
          );
        }
      }
    }

    if (key === "riesgos" && items === 0) {
      warnings.push(
        "\"Riesgos\" está vacío. Si genuinamente no hay riesgos, escribilo " +
          "explícito (\"ningún riesgo identificado\") para que sea decisión y no omisión.",
      );
    }

    if (key === "testCases" && items < 3) {
      errors.push(
        `"Test cases" debe declarar al menos 3 casos (golden + 2 edge). ` +
          `Encontrados: ${items}.`,
      );
    }

    if (key === "definitionOfDone" && items < 3) {
      warnings.push(
        `"Definition of Done" tiene ${items} ítems (recomendado ≥3). ` +
          "Considerá: tests, docs, deploy/migrations, feature flag si aplica.",
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sections,
  };
}

function humanLabel(key: keyof DorValidationDetail["sections"]): string {
  const labels: Record<keyof DorValidationDetail["sections"], string> = {
    objetivo: "Objetivo",
    contextoTecnico: "Contexto técnico",
    criteriosAceptacion: "Criterios de aceptación",
    fueraDeScope: "Fuera de scope",
    dependencias: "Dependencias",
    riesgos: "Riesgos",
    testCases: "Test cases declarados",
    definitionOfDone: "Definition of Done",
  };
  return labels[key];
}

// ─── DoR validation registration (V4.18) ────────────────────────────────────

export interface RegisterDorValidationResult {
  ok: boolean;
  validation?: DorValidation;
  detail?: DorValidationDetail;
  mode: "off" | "warn" | "strict";
  error?: string;
}

const MAX_DOR_BODY_LEN = 100_000; // 100 KB cap on body input

export async function validateAndRegisterDor(
  ticketId: string,
  body: string,
  options?: { skip?: boolean; skipReason?: string },
): Promise<RegisterDorValidationResult> {
  const data = await loadState();
  const config = await loadProjectConfig();
  const mode = config?.dorEnforcement ?? "off";

  if (!isSafeTicketId(ticketId)) {
    return {
      ok: false,
      mode,
      error: `Ticket ID inválido: "${ticketId}". Solo letras, números, guion y guion-bajo.`,
    };
  }

  // Allow ticket-level skip (e.g., hotfix branches). Persists with reason.
  if (options?.skip) {
    const reason = (options.skipReason ?? "").trim();
    if (!reason || reason.length < 10) {
      return {
        ok: false,
        mode,
        error:
          "⛔ Bypass de DoR requiere razón explícita (≥10 chars). " +
          "Ej: 'hotfix de producción — security incident #1234'.",
      };
    }
    const validation: DorValidation = {
      ticketId,
      status: "skipped",
      mode,
      errorCount: 0,
      warningCount: 0,
      timestamp: new Date().toISOString(),
      skipReason: reason,
    };
    data.dorValidation = validation;
    data.log.push({
      timestamp: validation.timestamp,
      action: "DOR_SKIPPED",
      detail: `Ticket ${ticketId}: bypass — ${reason}`,
    });
    await saveState(data);
    return { ok: true, validation, mode };
  }

  if (body.length > MAX_DOR_BODY_LEN) {
    return {
      ok: false,
      mode,
      error: `Body del ticket excede ${MAX_DOR_BODY_LEN} caracteres. Resumilo antes de validar.`,
    };
  }

  const detail = validateTicketDor(body);
  let status: DorStatus;
  if (detail.errors.length > 0) {
    status = "failed";
  } else if (detail.warnings.length > 0) {
    status = "warned";
  } else {
    status = "passed";
  }

  const validation: DorValidation = {
    ticketId,
    status,
    mode,
    errorCount: detail.errors.length,
    warningCount: detail.warnings.length,
    timestamp: new Date().toISOString(),
  };
  data.dorValidation = validation;
  data.log.push({
    timestamp: validation.timestamp,
    action: "DOR_VALIDATED",
    detail: `Ticket ${ticketId}: ${status} (mode=${mode}, errors=${detail.errors.length}, warnings=${detail.warnings.length})`,
  });
  await saveState(data);

  return { ok: true, validation, detail, mode };
}

// ─── Docs decision registration (V4.16) ─────────────────────────────────────

export interface RegisterDocsDecisionResult {
  ok: boolean;
  decision?: DocsDecision;
  error?: string;
}

const MAX_DOCS_REASON_LEN = 280;
const MAX_DOCS_FILES = 20;

export async function registerDocsDecision(
  status: DocsDecisionStatus,
  reason: string,
  files: string[],
): Promise<RegisterDocsDecisionResult> {
  const data = await loadState();

  if (data.state !== PipelineState.EVIDENCIA) {
    return {
      ok: false,
      error: `Solo se puede registrar la decisión de docs en estado EVIDENCIA. Estado actual: ${data.state}.`,
    };
  }

  const trimmedReason = (reason ?? "").trim();
  if (!trimmedReason) {
    return {
      ok: false,
      error:
        "⛔ La razón es obligatoria. " +
        "Si status='updated', describí qué se documentó y por qué (ej: 'nuevo endpoint POST /sessions'). " +
        "Si status='skipped', describí por qué se omite (ej: 'refactor interno sin cambio de contratos').",
    };
  }
  if (trimmedReason.length > MAX_DOCS_REASON_LEN) {
    return {
      ok: false,
      error: `⛔ La razón excede ${MAX_DOCS_REASON_LEN} caracteres. Resumila.`,
    };
  }

  const cleanFiles = (files ?? []).map((f) => f.trim()).filter(Boolean);
  if (status === "updated" && cleanFiles.length === 0) {
    return {
      ok: false,
      error:
        "⛔ status='updated' requiere al menos un archivo en `files`. " +
        "Si no escribiste docs, usá status='skipped' con razón.",
    };
  }
  if (status === "skipped" && cleanFiles.length > 0) {
    return {
      ok: false,
      error:
        "⛔ status='skipped' no debe traer archivos. Si escribiste docs, usá status='updated'.",
    };
  }
  if (cleanFiles.length > MAX_DOCS_FILES) {
    return {
      ok: false,
      error: `⛔ Demasiados archivos (${cleanFiles.length}). Máximo ${MAX_DOCS_FILES} — un solo ticket no debería tocar más.`,
    };
  }

  // When status="updated", verify each file exists on disk (mirrors the evidence gate).
  if (status === "updated") {
    for (const f of cleanFiles) {
      const fullPath = join(PROJECT_ROOT, f);
      try {
        await readFile(fullPath, "utf-8");
      } catch {
        return {
          ok: false,
          error: `⛔ El archivo de docs no existe: ${f}. Generalo antes de registrar la decisión.`,
        };
      }
    }
  }

  const decision: DocsDecision = {
    status,
    reason: trimmedReason,
    files: cleanFiles,
  };
  data.docsDecision = decision;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_DOCS_DECISION",
    detail:
      status === "updated"
        ? `docs updated for ${data.activeTicket}: ${cleanFiles.join(", ")} — ${trimmedReason}`
        : `docs skipped for ${data.activeTicket}: ${trimmedReason}`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, decision };
}

// ─── Merge registration ─────────────────────────────────────────────────────

export interface RegisterMergeResult {
  ok: boolean;
  error?: string;
}

export async function registerMerge(
  type: MergeType,
  targetBranch: string,
): Promise<RegisterMergeResult> {
  const data = await loadState();

  if (
    data.state !== PipelineState.EVIDENCIA &&
    data.state !== PipelineState.COMMIT
  ) {
    return {
      ok: false,
      error: `Solo se puede registrar merge en estado EVIDENCIA o COMMIT. Estado actual: ${data.state}.`,
    };
  }

  // Verify the merge actually happened: check that the feature branch
  // is an ancestor of the target branch (meaning it was merged)
  if (type === "direct") {
    const featureBranch = data.featureBranch ?? "";

    // Reject branch names with shell metacharacters or git ref-unsafe chars.
    // Git refs allow letters, digits, "/", "-", "_", ".". Anything else is suspicious.
    if (!isSafeBranchName(featureBranch) || !isSafeBranchName(targetBranch)) {
      return {
        ok: false,
        error:
          `⛔ Nombre de rama inválido: contiene caracteres no permitidos. ` +
          `featureBranch="${featureBranch}" targetBranch="${targetBranch}".`,
      };
    }

    try {
      // execFileSync (array form) is shell-free — no metachar interpolation.
      execFileSync(
        "git",
        ["merge-base", "--is-ancestor", featureBranch, targetBranch],
        { cwd: PROJECT_ROOT, encoding: "utf-8", stdio: "pipe" },
      );
    } catch {
      return {
        ok: false,
        error:
          `⛔ La rama "${data.featureBranch}" no fue mergeada a "${targetBranch}". ` +
          "Ejecutá el merge primero (git checkout dev && git merge feature/...) y después registrá.",
      };
    }
  }

  data.mergeRecord = { type, targetBranch };

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_MERGE",
    detail: `${type} merge to ${targetBranch} from ${data.featureBranch ?? "unknown"} for ticket ${data.activeTicket}. Verified in git.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true };
}

// ─── Target subproject (multi-target mode) ──────────────────────────────────

export interface SetTargetSubprojectResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

export async function setTargetSubproject(
  slug: string,
): Promise<SetTargetSubprojectResult> {
  const data = await loadState();

  // Solo válido entre TICKETS y PLAN (antes de implementar)
  if (
    data.state !== PipelineState.TICKETS &&
    data.state !== PipelineState.PLAN
  ) {
    return {
      ok: false,
      error: `Solo se puede setear el target subproject en estado TICKETS o PLAN. Estado actual: ${data.state}.`,
    };
  }

  // Defensa: setear target sin ticket activo carece de sentido y produce mensajes
  // de error confusos en el gate de IMPLEMENTACION. Forzar el orden correcto.
  if (!data.activeTicket) {
    return {
      ok: false,
      error:
        "⛔ No hay ticket activo. Llamá sdd_set_active_ticket(ticketId) ANTES de setTargetSubproject. " +
        "El target subproject pertenece al ticket — sin ticket no hay target.",
    };
  }

  const config = await loadProjectConfig();
  if (!config?.multiTargetMode) {
    return {
      ok: false,
      error:
        "⛔ El proyecto NO está en modo multi-target. setTargetSubproject solo aplica si project-profile.md tiene `Multi Target Mode: true`.",
    };
  }

  const allowed = config.subprojectSlugs ?? [];
  if (!allowed.includes(slug)) {
    return {
      ok: false,
      error:
        `⛔ Slug "${slug}" no está en la lista de subproyectos del proyecto. ` +
        `Subproyectos válidos: [${allowed.join(", ")}].`,
    };
  }

  data.targetSubproject = slug;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "SET_TARGET_SUBPROJECT",
    detail: `Target subproject set to "${slug}" for ticket ${data.activeTicket ?? "(none yet)"}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, slug };
}

export interface ConfirmNextResult {
  ok: boolean;
  remainingTickets: string[];
  error?: string;
}

export async function confirmNext(): Promise<ConfirmNextResult> {
  const data = await loadState();

  if (data.state !== PipelineState.COMPLETADO) {
    return {
      ok: false,
      remainingTickets: [],
      error: `Solo se puede confirmar continuación en estado COMPLETADO. Estado actual: ${data.state}.`,
    };
  }

  if (!data.awaitingUserConfirmation) {
    return {
      ok: false,
      remainingTickets: [],
      error: "No hay confirmación pendiente.",
    };
  }

  data.awaitingUserConfirmation = false;

  const completedTicket = data.activeTicket;
  const remaining = data.tickets
    .filter((t) => t.id !== completedTicket)
    .map((t) => t.id);

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "USER_CONFIRMED_NEXT",
    detail: `User confirmed continue after completing ${completedTicket}. Remaining: ${remaining.length}.`,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, remainingTickets: remaining };
}

export interface GetStateResult {
  state: PipelineState;
  stateDescription: string;
  change: string | null;
  activeTicket: string | null;
  tickets: TicketEntry[];
  nextAction: string;
  nextCommand: string;
  awaitingUserConfirmation: boolean;
  featureBranch: string | null;
  mergeRecord: { type: string; targetBranch: string } | null;
  awaitingVerification: boolean;
  sprintValidated: boolean;
  evidenceFilePath: string | null;
  targetSubproject: string | null;
  docsDecision: DocsDecision | null;
  /** V4.18: DoR validation snapshot for the active ticket. null if not validated yet. */
  dorValidation: DorValidation | null;
  /** V4.19: change-level decisions captured during gap analysis. */
  changeDecisions: ChangeDecision[];
  /** V4.19: change-level risk classification. */
  changeRisk: RiskClassification | null;
  /** V4.19: per-ticket risk classifications, keyed by ticket ID. */
  ticketRisks: Record<string, RiskClassification>;
  /** V4.20: auto-verify result for active ticket. null if not run. */
  autoVerifyResult: AutoVerifyResult | null;
  /** V4.21: /goal batch session (if any). null if no active batch. */
  goalSession: GoalSession | null;
  /** Last N log entries. V4.17+ trims to 5 by default to save tokens.
   *  Call sdd_get_state with fullLog=true to retrieve the entire persisted log. */
  log: LogEntry[];
  /** Total entries in the persisted log (file). Useful when log is trimmed. */
  logTotal: number;
}

/** V4.17: default tail size for the log in getState output. */
const DEFAULT_LOG_TAIL = 5;

export async function getState(options?: { fullLog?: boolean }): Promise<GetStateResult> {
  const data = await loadState();
  const fullLog = options?.fullLog === true;

  // Resolve {tracker} and {tipo} placeholders in nextCommand using project config
  let nextCommand = NEXT_COMMANDS[data.state];
  const config = await loadProjectConfig();
  if (config) {
    nextCommand = nextCommand
      .replace(/\{tracker\}/g, config.tracker || "jira")
      .replace(/\{tipo\}/g, config.tipo || "fullstack");
  }

  const totalLog = data.log.length;
  const log = fullLog ? data.log : data.log.slice(-DEFAULT_LOG_TAIL);

  return {
    state: data.state,
    stateDescription: STATE_DESCRIPTIONS[data.state],
    change: data.change,
    activeTicket: data.activeTicket,
    tickets: data.tickets,
    nextAction: NEXT_ACTIONS[data.state],
    nextCommand,
    awaitingUserConfirmation: data.awaitingUserConfirmation ?? false,
    featureBranch: data.featureBranch ?? null,
    mergeRecord: data.mergeRecord ?? null,
    awaitingVerification: data.awaitingVerification ?? false,
    sprintValidated: data.sprintValidated ?? false,
    evidenceFilePath: data.evidenceFilePath ?? null,
    targetSubproject: data.targetSubproject ?? null,
    docsDecision: data.docsDecision ?? null,
    dorValidation: data.dorValidation ?? null,
    changeDecisions: data.changeDecisions ?? [],
    changeRisk: data.changeRisk ?? null,
    ticketRisks: data.ticketRisks ?? {},
    autoVerifyResult: data.autoVerifyResult ?? null,
    goalSession: data.goalSession ?? null,
    log,
    logTotal: totalLog,
  };
}
