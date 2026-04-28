import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
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
import type { PipelineData, LogEntry, TicketEntry, MergeType } from "./types.js";
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
}

export async function getState(): Promise<GetStateResult> {
  const data = await loadState();

  // Resolve {tracker} and {tipo} placeholders in nextCommand using project config
  let nextCommand = NEXT_COMMANDS[data.state];
  const config = await loadProjectConfig();
  if (config) {
    nextCommand = nextCommand
      .replace(/\{tracker\}/g, config.tracker || "jira")
      .replace(/\{tipo\}/g, config.tipo || "fullstack");
  }

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
  };
}
