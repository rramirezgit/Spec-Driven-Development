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

export interface PipelineData {
  state: PipelineState;
  change: string | null;
  activeTicket: string | null;
  tickets: TicketEntry[];
  mcpAvailable: boolean;
  log: LogEntry[];
}

export interface ProjectConfig {
  nombre: string;
  tipo: string;
  tracker: string;
  cloudId: string;
  projectKey: string;
  idioma: string;
}

export const VALID_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  [PipelineState.IDLE]: [
    PipelineState.ARTEFACTOS,
    PipelineState.TICKETS,
  ],
  [PipelineState.ARTEFACTOS]: [PipelineState.TICKETS],
  [PipelineState.TICKETS]: [PipelineState.PLAN],
  [PipelineState.PLAN]: [PipelineState.IMPLEMENTACION],
  [PipelineState.IMPLEMENTACION]: [PipelineState.EVIDENCIA],
  [PipelineState.EVIDENCIA]: [PipelineState.COMMIT],
  [PipelineState.COMMIT]: [PipelineState.COMPLETADO],
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
  [PipelineState.EVIDENCIA]: "Evidencia generada — commit + PR",
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
  [PipelineState.IMPLEMENTACION]: "Generar evidencia de QA",
  [PipelineState.EVIDENCIA]: "Commit + PR + transición QA",
  [PipelineState.COMMIT]: "Marcar ticket como completado",
  [PipelineState.COMPLETADO]: "Siguiente ticket o archivar change",
};

/** Maps each state to the recommended command */
export const NEXT_COMMANDS: Record<PipelineState, string> = {
  [PipelineState.IDLE]: "/menu",
  [PipelineState.ARTEFACTOS]: "/create-{tracker}-tickets",
  [PipelineState.TICKETS]: "/plan-{tipo}-ticket <ID>",
  [PipelineState.PLAN]: "/develop-{tipo} <ID>",
  [PipelineState.IMPLEMENTACION]: "/evidence <ID>",
  [PipelineState.EVIDENCIA]: "/commit",
  [PipelineState.COMMIT]: "sdd_advance(COMPLETADO)",
  [PipelineState.COMPLETADO]: "sdd_advance(TICKETS) o sdd_advance(IDLE)",
};

export function defaultPipelineData(): PipelineData {
  return {
    state: PipelineState.IDLE,
    change: null,
    activeTicket: null,
    tickets: [],
    mcpAvailable: true,
    log: [],
  };
}
