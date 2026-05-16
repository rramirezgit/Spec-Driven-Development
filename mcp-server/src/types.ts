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
}

export type DocsDecisionStatus = "updated" | "skipped";

export interface DocsDecision {
  status: DocsDecisionStatus;
  /** Trigger that fired (when updated) or reason for skipping. Human-readable, short. */
  reason: string;
  /** Files written/updated when status="updated". Empty when status="skipped". */
  files: string[];
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
  };
}
