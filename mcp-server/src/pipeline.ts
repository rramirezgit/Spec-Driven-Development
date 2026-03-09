import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  PipelineState,
  VALID_TRANSITIONS,
  NEXT_ACTIONS,
  NEXT_COMMANDS,
  STATE_DESCRIPTIONS,
  defaultPipelineData,
} from "./types.js";
import type { PipelineData, LogEntry, TicketEntry } from "./types.js";

const STATE_PATH = join(
  process.cwd(),
  ".ai-internal",
  "pipeline-state.json",
);

export async function loadState(): Promise<PipelineData> {
  try {
    const content = await readFile(STATE_PATH, "utf-8");
    const data = JSON.parse(content) as PipelineData;
    // Validate state is a known enum value
    if (!Object.values(PipelineState).includes(data.state)) {
      data.state = PipelineState.IDLE;
    }
    return data;
  } catch {
    return defaultPipelineData();
  }
}

export async function saveState(data: PipelineData): Promise<void> {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(data, null, 2), "utf-8");
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

  data.state = to;
  if (change) data.change = change;

  // Reset active ticket when going back to IDLE
  if (to === PipelineState.IDLE) {
    data.activeTicket = null;
    data.tickets = [];
    data.change = null;
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
      error: `Solo se pueden registrar tickets en estado ARTEFACTOS o TICKETS. Estado actual: ${data.state}.`,
    };
  }

  data.tickets = tickets;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    action: "REGISTER_TICKETS",
    count: tickets.length,
  };
  data.log.push(logEntry);

  await saveState(data);
  return { ok: true, count: tickets.length };
}

export interface SetActiveTicketResult {
  ok: boolean;
  ticket?: TicketEntry;
  error?: string;
}

export async function setActiveTicket(
  ticketId: string,
): Promise<SetActiveTicketResult> {
  const data = await loadState();

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

export interface GetStateResult {
  state: PipelineState;
  stateDescription: string;
  change: string | null;
  activeTicket: string | null;
  tickets: TicketEntry[];
  nextAction: string;
  nextCommand: string;
}

export async function getState(): Promise<GetStateResult> {
  const data = await loadState();
  return {
    state: data.state,
    stateDescription: STATE_DESCRIPTIONS[data.state],
    change: data.change,
    activeTicket: data.activeTicket,
    tickets: data.tickets,
    nextAction: NEXT_ACTIONS[data.state],
    nextCommand: NEXT_COMMANDS[data.state],
  };
}
