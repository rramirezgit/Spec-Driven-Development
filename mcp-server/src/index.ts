import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PipelineState } from "./types.js";
import { validateConfig, loadProjectConfig } from "./config.js";
import {
  advance,
  getState,
  registerTickets,
  setActiveTicket,
} from "./pipeline.js";
import { transitionToQA } from "./jira.js";

const server = new McpServer({
  name: "sdd-pipeline",
  version: "1.0.0",
});

// ─── Tool 1: sdd_check_config ───────────────────────────────────────────────

server.tool(
  "sdd_check_config",
  "Valida la configuración del proyecto (project-profile, cloudId, tracker). Gate obligatorio antes de cualquier acción.",
  {},
  async () => {
    const result = await validateConfig();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 2: sdd_get_state ──────────────────────────────────────────────────

server.tool(
  "sdd_get_state",
  "Lee pipeline-state.json y retorna el estado actual del pipeline + qué acción sigue.",
  {},
  async () => {
    const result = await getState();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 3: sdd_advance ────────────────────────────────────────────────────

const pipelineStateValues = Object.values(PipelineState) as [string, ...string[]];

server.tool(
  "sdd_advance",
  "Valida y ejecuta una transición de estado en el pipeline. Rechaza transiciones ilegales con error explícito.",
  {
    to: z.enum(pipelineStateValues).describe("Estado destino de la transición"),
    change: z
      .string()
      .optional()
      .describe("Nombre del change (solo al iniciar un nuevo pipeline desde IDLE)"),
  },
  async ({ to, change }) => {
    const result = await advance(to as PipelineState, change);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 4: sdd_register_tickets ───────────────────────────────────────────

server.tool(
  "sdd_register_tickets",
  "Registra tickets creados en el pipeline. Solo válido en estado ARTEFACTOS o TICKETS.",
  {
    tickets: z
      .array(
        z.object({
          id: z.string().describe("ID del ticket (ej: AUTH-45)"),
          title: z.string().describe("Título del ticket"),
        }),
      )
      .describe("Lista de tickets a registrar"),
  },
  async ({ tickets }) => {
    const ticketEntries = tickets.map((t) => ({
      ...t,
      qaTransition: null,
    }));
    const result = await registerTickets(ticketEntries);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 5: sdd_set_active_ticket ──────────────────────────────────────────

server.tool(
  "sdd_set_active_ticket",
  "Marca un ticket como activo. Valida que el ticket exista en la lista registrada.",
  {
    ticketId: z.string().describe("ID del ticket a activar"),
  },
  async ({ ticketId }) => {
    const result = await setActiveTicket(ticketId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 6: sdd_transition_jira ────────────────────────────────────────────

server.tool(
  "sdd_transition_jira",
  "Busca y ejecuta la transición a QA Review para un ticket via Jira REST API.",
  {
    ticketId: z.string().describe("ID del ticket a transicionar (ej: AUTH-45)"),
  },
  async ({ ticketId }) => {
    const config = await loadProjectConfig();
    if (!config || !config.cloudId) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: false,
              transitioned: false,
              error:
                "CloudId no configurado. No se puede interactuar con Jira.",
            }),
          },
        ],
      };
    }

    const result = await transitionToQA(config.cloudId, ticketId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// ─── Start server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
