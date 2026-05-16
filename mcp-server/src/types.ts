export enum PipelineState {
  IDLE = "IDLE",
  ARTEFACTOS = "ARTEFACTOS",
  TICKETS = "TICKETS",
  PLAN = "PLAN",
  IMPLEMENTACION = "IMPLEMENTACION",
  EVIDENCIA = "EVIDENCIA",
  COMMIT = "COMMIT",
  COMPLETADO = "COMPLETADO",
}

export interface TicketEntry {
  id: string;
  title: string;
  qaTransition: string | null;
}

export interface LogEntry {
  timestamp: string;
  action: string;
  from?: string;
  to?: string;
  count?: number;
  detail?: string;
}

export type MergeType = "direct" | "pr";

export interface MergeRecord {
  /** "direct" = git merge (feature→dev), "pr" = pull request (hotfix→main, release dev→main) */
  type: MergeType;
  /** Target branch (e.g., "dev", "main") */
  targetBranch: string;
}

export interface PipelineData {
  state: PipelineState;
  change: string | null;
  activeTicket: string | null;
  tickets: TicketEntry[];
  log: LogEntry[];
  /** True when in COMPLETADO and user hasn't confirmed to continue yet */
  awaitingUserConfirmation?: boolean;
  /** Name of the feature branch created for the active ticket */
  featureBranch?: string | null;
  /** Records how the code was merged (direct merge vs PR) */
  mergeRecord?: MergeRecord | null;
  /** True when implementation is done but user hasn't verified it works yet */
  awaitingVerification?: boolean;
  /** True when sprint has been validated for the active ticket */
  sprintValidated?: boolean;
  /** Path to the evidence file for the active ticket */
  evidenceFilePath?: string | null;
  /** Slug of the active subproject target (only used when project is in multi-target mode) */
  targetSubproject?: string | null;
  /** Docs decision for the active ticket (V4.16+). Required before COMMIT when docusaurus is enabled. */
  docsDecision?: DocsDecision | null;
  /** V4.18: DoR validation snapshot for the active ticket.
   *  In strict mode, sdd_advance(PLAN) requires status === "passed" or "skipped".
   *  Cleared automatically on cycle reset (COMPLETADO→TICKETS, IDLE). */
  dorValidation?: DorValidation | null;
  /** V4.19: change-level decisions captured during gap analysis in menu Opción 1.
   *  Persisted across the entire change (NOT cleared on per-ticket cycle reset);
   *  cleared only on IDLE. Read by /create-tickets to bake into Story bodies. */
  changeDecisions?: ChangeDecision[];
  /** V4.19: change-level risk classification (set during menu Opción 1 risk pass).
   *  Per-ticket risk overrides this for individual ticket gating. */
  changeRisk?: RiskClassification | null;
  /** V4.19: per-ticket risk classification, keyed by ticket ID.
   *  Used by /goal for autonomy decisions; populated as tickets are created or
   *  refined. Cleared on IDLE only (we want the map to persist across the change). */
  ticketRisks?: Record<string, RiskClassification>;
  /** V4.20: smoke-test outcome for the active ticket.
   *  Cleared on cycle restart (COMPLETADO→TICKETS) and IDLE.
   *  In enforced mode, IMPLEMENTACION → EVIDENCIA requires status to be
   *  "passed", "inconclusive" (degrade gracefully), or "skipped". */
  autoVerifyResult?: AutoVerifyResult | null;
  /** V4.21: /goal batch session (if active). Persists across cycle restarts
   *  for the duration of the batch. Cleared on IDLE or batch finish. */
  goalSession?: GoalSession | null;
}

export type DocsDecisionStatus = "updated" | "skipped";

export interface DocsDecision {
  status: DocsDecisionStatus;
  /** Trigger that fired (when updated) or reason for skipping. Human-readable, short. */
  reason: string;
  /** Files written/updated when status="updated". Empty when status="skipped". */
  files: string[];
}

/** V4.21 — /goal batch session. Track el progreso de un batch de tickets
 *  ejecutados con autonomía limitada. Modes:
 *  - "supervised": pausa solo en risk/pre-flight fail; commits locales; sin push/merge.
 *  - "auto-merge-final": como supervised pero al final ofrece merge batch a dev.
 *  - "yolo": con safeguards (no toca prod, no push automático).
 *
 *  Cada ticket termina en uno de cuatro estados:
 *  - "completed": cycle full ran, ready to be merged
 *  - "paused": user input required (pre-flight fail, auto-verify fail, etc.)
 *  - "failed": unrecoverable error
 *  - "skipped": pre-flight clasificó alto riesgo y el user decidió saltarlo
 */
export type GoalMode = "supervised" | "auto-merge-final" | "yolo";
export type GoalTicketStatus = "pending" | "in_progress" | "completed" | "paused" | "failed" | "skipped";

export interface GoalTicketProgress {
  ticketId: string;
  status: GoalTicketStatus;
  /** Razón de pausa/fallo. Vacío cuando completed/pending. */
  reason?: string;
  /** Outcome del auto-verify de este ticket, si corrió. */
  autoVerify?: AutoVerifyStatus;
  /** ISO timestamps de cuándo se inició y completó (si aplica). */
  startedAt?: string;
  finishedAt?: string;
}

export interface GoalSession {
  /** Lista ordenada de tickets que forman el batch. */
  tickets: string[];
  mode: GoalMode;
  /** Progreso por ticket, keyed por ticketId. */
  progress: Record<string, GoalTicketProgress>;
  /** Cuándo arrancó el batch. */
  startedAt: string;
  /** Cuándo terminó (todos los tickets resueltos o batch abortado). null mientras corre. */
  finishedAt?: string | null;
  /** Si el batch fue abortado por el user u por error catastrófico. */
  aborted?: boolean;
  /** Razón del abort, si aborted=true. */
  abortReason?: string;
}

/** V4.20 — Auto-verify smoke test result. */
export type AutoVerifyStatus = "passed" | "failed" | "inconclusive" | "skipped";

export interface AutoVerifyTestCase {
  /** Trigger del clasificador que originó este test (T1, T2, T7, etc.). */
  trigger: string;
  /** Descripción humana corta. */
  description: string;
  /** Outcome individual. */
  outcome: "passed" | "failed" | "inconclusive";
  /** Detalle conciso (status code, error, observación). Máx 200 chars. */
  detail?: string;
}

export interface AutoVerifyResult {
  status: AutoVerifyStatus;
  /** Razón del status global (ej. "dev server no respondió en :3000" si inconclusive). */
  reason: string;
  /** Casos individuales corridos. Vacío si status=skipped o inconclusive temprano. */
  cases: AutoVerifyTestCase[];
  /** Lista de blockers (issues que el dev debe revisar antes de evidence). */
  blockers: string[];
  timestamp: string;
}

/** V4.19 — Change-level decision made during gap analysis (menu Opción 1).
 *  Persisted in PipelineData.changeDecisions; consumed by /create-tickets to
 *  bake answers into each ticket Story (so we don't ask the same questions
 *  per-ticket during enrich). */
export interface ChangeDecision {
  /** The original question the agent asked (short, one sentence). */
  question: string;
  /** The user's selected answer or free-text response. */
  answer: string;
  /** Which future ticket(s) this decision affects — informational, used to
   *  inline the relevant decisions into each Story. Empty = global to change. */
  affectsTickets?: string[];
  /** ISO timestamp when registered. */
  timestamp: string;
}

/** V4.19 — Risk classification levels for a change or ticket.
 *  Drives autonomy decisions in /goal and surfacing in evidence. */
export type RiskLevel = "low" | "medium" | "high";

export interface RiskClassification {
  level: RiskLevel;
  /** Concrete reasons (path matches, keyword hits) that produced this level.
   *  Used to explain the classification to the human, not for re-derivation. */
  reasons: string[];
  /** ISO timestamp when classified. */
  timestamp: string;
}

/** V4.18 — Definition of Ready validation result.
 *  `status`: outcome of the last validator run for the active ticket.
 *    - "passed": all 8 required sections present + no errors.
 *    - "warned": sections present but some warnings (vague AC, low counts).
 *    - "failed": one or more required sections missing or empty.
 *    - "skipped": dev explicitly bypassed (e.g., hotfix with --skip-dor).
 *  `mode`: enforcement mode active when the validation ran (snapshot, so a
 *    later mode change doesn't silently relax a registered gate). */
export type DorStatus = "passed" | "warned" | "failed" | "skipped";

export interface DorValidation {
  ticketId: string;
  status: DorStatus;
  mode: "off" | "warn" | "strict";
  errorCount: number;
  warningCount: number;
  /** ISO timestamp when validation ran. */
  timestamp: string;
  /** Optional bypass reason when status === "skipped". */
  skipReason?: string;
}

export interface SubprojectConfig {
  path: string;
  tipo: string;
  framework: string;
  uiLibrary?: string;
  orm?: string;
  testing?: string;
}

export interface ProjectConfig {
  nombre: string;
  tipo: string;
  tracker: "jira" | "notion" | string;
  // Jira-specific (optional — only required when tracker=jira)
  cloudId?: string;
  projectKey?: string;
  jiraQaStatus?: string;
  // Notion-specific (optional — only required when tracker=notion)
  notionDatabaseId?: string;
  notionStatusProperty?: string;
  notionQaStatus?: string;
  // Common
  idioma: string;
  /** Present when tipo is "monorepo-fullstack" — describes each subdirectory */
  subprojects?: SubprojectConfig[];
  /** True when project is in multi-target mode (one set of commands per subproject) */
  multiTargetMode?: boolean;
  /** Slugs of subprojects (only set when multiTargetMode is true) */
  subprojectSlugs?: string[];
  /** Commit message style. "conventional" → `<type>(<scope>): <subject>` + Refs footer.
   *  "standard" → `TICKET-ID: <subject>` (default histórico de SDD). V4.14+ */
  commitStyle?: "standard" | "conventional";
  /** Docusaurus integration (V4.16+). Present when phase 0b detected docusaurus.config.* */
  docusaurus?: DocusaurusConfig;
  /** Definition of Ready enforcement (V4.18+).
   *  - "off": validator no se ejecuta (compat con proyectos pre-V4.18).
   *  - "warn": validator corre, warnings se muestran pero NO bloquean PLAN.
   *  - "strict": validator corre, errors bloquean sdd_advance(PLAN). */
  dorEnforcement?: "off" | "warn" | "strict";
  /** Auto-verify config (V4.20+). Present when phase 0b detectó dev server
   *  capability y el user habilitó en phase 0c. Si ausente, /auto-verify no
   *  corre y el gate está inactivo. */
  autoVerify?: AutoVerifyConfig;
}

export interface AutoVerifyConfig {
  enabled: boolean;
  /** Default dev server port leído del config del framework o del .env. */
  devPort?: number;
  /** Endpoint de health/ping si fue detectado (ej: "/health", "/ping"). */
  healthEndpoint?: string;
  /** Si true, IMPLEMENTACION → EVIDENCIA exige que `autoVerifyResult.status`
   *  sea passed/skipped. Si false (default = warn-equivalent), el resultado
   *  es informativo: no bloquea. */
  enforced: boolean;
}

export interface DocusaurusConfig {
  /** Root folder containing docusaurus.config.* — e.g. "apps/docs", "website", or "." */
  root: string;
  /** Folder inside root where docs live — usually "docs". Resolved from config or default. */
  docsPath: string;
  /** Whether SDD should write docs here. Default true once detected; user can disable in phase 0c. */
  enabled: boolean;
  /** "critical" (default): only document when a high-confidence trigger fires. */
  mode: "critical";
}

export const VALID_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  [PipelineState.IDLE]: [
    PipelineState.ARTEFACTOS,
    PipelineState.TICKETS,
  ],
  [PipelineState.ARTEFACTOS]: [PipelineState.TICKETS, PipelineState.IDLE],
  [PipelineState.TICKETS]: [PipelineState.PLAN, PipelineState.IDLE],
  [PipelineState.PLAN]: [PipelineState.IMPLEMENTACION, PipelineState.IDLE],
  [PipelineState.IMPLEMENTACION]: [PipelineState.EVIDENCIA, PipelineState.IDLE],
  [PipelineState.EVIDENCIA]: [PipelineState.COMMIT, PipelineState.IDLE],
  [PipelineState.COMMIT]: [PipelineState.COMPLETADO, PipelineState.IDLE],
  [PipelineState.COMPLETADO]: [PipelineState.TICKETS, PipelineState.IDLE],
};

/** Human-readable descriptions for each state */
export const STATE_DESCRIPTIONS: Record<PipelineState, string> = {
  [PipelineState.IDLE]: "Sin pipeline activo — mostrar menú",
  [PipelineState.ARTEFACTOS]:
    "Artefactos de planificación creados — crear tickets",
  [PipelineState.TICKETS]: "Tickets creados — seleccionar y planificar",
  [PipelineState.PLAN]: "Plan técnico listo — implementar",
  [PipelineState.IMPLEMENTACION]:
    "Código implementado — generar evidencia",
  [PipelineState.EVIDENCIA]: "Evidencia generada — commit + merge a dev",
  [PipelineState.COMMIT]: "Commit realizado — completar ciclo",
  [PipelineState.COMPLETADO]:
    "Ticket completado — siguiente ticket o archivar",
};

/** Maps each state to the next action description */
export const NEXT_ACTIONS: Record<PipelineState, string> = {
  [PipelineState.IDLE]: "Elegir flujo desde el menú",
  [PipelineState.ARTEFACTOS]: "Crear tickets en el tracker",
  [PipelineState.TICKETS]: "Seleccionar ticket y crear plan técnico",
  [PipelineState.PLAN]: "Implementar el plan técnico",
  [PipelineState.IMPLEMENTACION]: "Verificar con usuario que funciona (sdd_confirm_implementation) → generar evidencia",
  [PipelineState.EVIDENCIA]: "Commit + merge a dev + transición QA",
  [PipelineState.COMMIT]: "Marcar ticket como completado",
  [PipelineState.COMPLETADO]: "Preguntar al usuario si quiere continuar (sdd_confirm_next requerido)",
};

/** Maps each state to the recommended command.
 *  For monorepo-fullstack projects, {tipo} resolves to "frontend" or "backend"
 *  depending on which part the ticket affects. If both, run backend first then frontend. */
export const NEXT_COMMANDS: Record<PipelineState, string> = {
  [PipelineState.IDLE]: "/menu",
  [PipelineState.ARTEFACTOS]: "/create-{tracker}-tickets",
  [PipelineState.TICKETS]: "/plan-{tipo}-ticket <ID>",
  [PipelineState.PLAN]: "/develop-{tipo} <ID>",
  [PipelineState.IMPLEMENTACION]: "/evidence <ID>",
  [PipelineState.EVIDENCIA]: "/commit",
  [PipelineState.COMMIT]: "sdd_advance(COMPLETADO)",
  [PipelineState.COMPLETADO]: "AskUserQuestion → sdd_confirm_next → sdd_advance(TICKETS) o sdd_advance(IDLE)",
};

export function defaultPipelineData(): PipelineData {
  return {
    state: PipelineState.IDLE,
    change: null,
    activeTicket: null,
    tickets: [],
    log: [],
    awaitingUserConfirmation: false,
    featureBranch: null,
    mergeRecord: null,
    awaitingVerification: false,
    sprintValidated: false,
    evidenceFilePath: null,
    targetSubproject: null,
    docsDecision: null,
    dorValidation: null,
    changeDecisions: [],
    changeRisk: null,
    ticketRisks: {},
    autoVerifyResult: null,
    goalSession: null,
  };
}
