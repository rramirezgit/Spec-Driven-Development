import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PipelineState } from "./types.js";
import { validateConfig, loadProjectConfig } from "./config.js";
import {
  advance,
  getState,
  loadState,
  registerTickets,
  setActiveTicket,
  confirmNext,
  registerBranch,
  registerScreenshot,
} from "./pipeline.js";
import { buildTransitionInstructions, buildCommentInstructions } from "./jira.js";

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

// ─── Tool 6: sdd_register_branch ─────────────────────────────────────────────

server.tool(
  "sdd_register_branch",
  "Registra la rama feature creada para el ticket activo. " +
    "OBLIGATORIO antes de implementar — sdd_advance(IMPLEMENTACION) fallará sin rama registrada. " +
    "La rama DEBE seguir el patrón feature/{TICKET_ID}-slug. " +
    "Ramas protegidas (main, dev, master, develop) son RECHAZADAS. " +
    "NUNCA se implementa directamente en ramas de integración.",
  {
    branchName: z.string().describe("Nombre de la rama creada (ej: feature/AUTH-45-login-google)"),
  },
  async ({ branchName }) => {
    const result = await registerBranch(branchName);
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

// ─── Tool 7: sdd_register_screenshot ────────────────────────────────────────

server.tool(
  "sdd_register_screenshot",
  "Registra que se capturó un screenshot de evidencia visual. " +
    "OBLIGATORIO para proyectos frontend/fullstack/mobile — sdd_advance(COMMIT) fallará sin screenshot. " +
    "ANTES de llamar este tool: 1) Iniciar el proyecto (npm run dev o similar), " +
    "2) Navegar a la página afectada con Chrome DevTools o Playwright, " +
    "3) Capturar screenshot con take_screenshot, " +
    "4) Guardar en docs/evidence/screenshots/{TICKET_ID}.png. " +
    "VIOLACIÓN: registrar screenshot sin haberlo capturado realmente.",
  {
    filePath: z.string().describe("Ruta del archivo de screenshot capturado (ej: docs/evidence/screenshots/AUTH-45.png)"),
  },
  async ({ filePath }) => {
    const result = await registerScreenshot(filePath);
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

// ─── Tool 8: sdd_confirm_next ────────────────────────────────────────────────

server.tool(
  "sdd_confirm_next",
  "Desbloquea la transición al siguiente ticket DESPUÉS de que el usuario confirmó explícitamente. " +
    "OBLIGATORIO: antes de llamar este tool, DEBÉS haber mostrado el resumen del ticket completado " +
    "y usado AskUserQuestion para preguntar al usuario si quiere continuar. " +
    "Si el usuario NO respondió aún, NO llames este tool. " +
    "VIOLACIÓN: llamar este tool sin confirmación del usuario es una violación del protocolo.",
  {},
  async () => {
    const result = await confirmNext();
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

// ─── Tool 9: sdd_transition_jira ──────────────────────────────────────────

const VALID_STATES_FOR_JIRA_TRANSITION = [
  PipelineState.COMMIT,
  PipelineState.COMPLETADO,
];

server.tool(
  "sdd_transition_jira",
  "Genera instrucciones para transicionar un ticket a QA Review usando el MCP de Atlassian. SOLO válido en estado COMMIT o COMPLETADO — requiere haber pasado por evidencia y commit primero.",
  {
    ticketId: z.string().describe("ID del ticket a transicionar (ej: AUTH-45)"),
  },
  async ({ ticketId }) => {
    const data = await loadState();
    if (!VALID_STATES_FOR_JIRA_TRANSITION.includes(data.state)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: false,
              error: `No se puede transicionar a QA desde el estado ${data.state}. Se requiere completar el ciclo: IMPLEMENTACION → EVIDENCIA → COMMIT antes de transicionar. Estados válidos: [${VALID_STATES_FOR_JIRA_TRANSITION.join(", ")}].`,
            }, null, 2),
          },
        ],
      };
    }
    const result = await buildTransitionInstructions(ticketId);
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

// ─── Tool 10: sdd_comment_jira ──────────────────────────────────────────────

const VALID_STATES_FOR_JIRA_COMMENT = [
  PipelineState.COMMIT,
  PipelineState.COMPLETADO,
];

server.tool(
  "sdd_comment_jira",
  "Genera instrucciones para agregar un comentario a un ticket usando el MCP de Atlassian. SOLO válido en estado COMMIT o COMPLETADO.",
  {
    ticketId: z.string().describe("ID del ticket (ej: AUTH-45)"),
    body: z.string().describe("Contenido del comentario"),
  },
  async ({ ticketId, body }) => {
    const data = await loadState();
    if (!VALID_STATES_FOR_JIRA_COMMENT.includes(data.state)) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: false,
              error: `No se puede comentar en Jira desde el estado ${data.state}. Se requiere completar el ciclo: IMPLEMENTACION → EVIDENCIA → COMMIT antes de comentar. Estados válidos: [${VALID_STATES_FOR_JIRA_COMMENT.join(", ")}].`,
            }, null, 2),
          },
        ],
      };
    }
    const result = await buildCommentInstructions(ticketId, body);
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
