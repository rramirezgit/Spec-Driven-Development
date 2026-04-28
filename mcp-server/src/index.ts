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
  registerMerge,
  confirmImplementation,
  confirmSprint,
  registerEvidence,
} from "./pipeline.js";
import type { MergeType } from "./types.js";
import {
  buildTransitionInstructions,
  buildCommentInstructions,
} from "./tracker.js";

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

// ─── Tool 7: sdd_confirm_sprint ──────────────────────────────────────────────

server.tool(
  "sdd_confirm_sprint",
  "Confirma que el sprint fue validado para el ticket. " +
    "OBLIGATORIO antes de sdd_set_active_ticket — el server rechazará activar un ticket sin sprint validado. " +
    "ANTES de llamar: verificar con getJiraIssue que el ticket tiene sprint.state='active'. " +
    "Si el proyecto es Kanban (sin sprints), pasar kanban=true para bypass.",
  {
    kanban: z
      .boolean()
      .optional()
      .default(false)
      .describe("true si el proyecto es Kanban y no usa sprints"),
  },
  async ({ kanban }) => {
    const result = await confirmSprint(kanban);
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

// ─── Tool 8: sdd_confirm_implementation ─────────────────────────────────────

server.tool(
  "sdd_confirm_implementation",
  "Confirma que el usuario verificó que la implementación funciona. " +
    "OBLIGATORIO antes de generar evidencia — sdd_advance(EVIDENCIA) fallará sin verificación. " +
    "ANTES de llamar: mostrar archivos modificados, tests ejecutados, " +
    "y preguntar al usuario con AskUserQuestion si funciona correctamente. " +
    "SOLO llamar DESPUÉS de que el usuario respondió 'sí funciona'. " +
    "VIOLACIÓN: llamar sin confirmación del usuario.",
  {},
  async () => {
    const result = await confirmImplementation();
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

// ─── Tool 9: sdd_register_evidence ─────────────────────────────────────────

server.tool(
  "sdd_register_evidence",
  "Registra el archivo de evidencia generado. " +
    "OBLIGATORIO antes de commit — sdd_advance(COMMIT) fallará sin evidencia registrada. " +
    "El archivo DEBE existir en disco — el server verifica que el archivo existe. " +
    "No se puede falsear: si el archivo no existe, el registro falla.",
  {
    filePath: z
      .string()
      .describe("Ruta relativa al archivo de evidencia (ej: docs/evidence/AUTH-45.md)"),
  },
  async ({ filePath }) => {
    const result = await registerEvidence(filePath);
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

// ─── Tool 10: sdd_register_merge ─────────────────────────────────────────────

server.tool(
  "sdd_register_merge",
  "Registra cómo se mergeó el código. OBLIGATORIO antes de completar — sdd_advance(COMPLETADO) fallará sin merge registrado. " +
    "REGLAS ESTRICTAS: " +
    "Feature branches (feature/*) → type='direct', targetBranch='dev' (merge directo, SIN PR). " +
    "Hotfix branches (hotfix/*) → type='pr', targetBranch='main' (PR directo a main). " +
    "NUNCA crear PR para feature branches. Los PR solo existen en release (dev→main) o hotfix (→main). " +
    "VIOLACIÓN: crear un PR para una feature branch es una violación grave del flujo.",
  {
    type: z.enum(["direct", "pr"]).describe("'direct' = git merge directo (feature→dev), 'pr' = pull request (hotfix→main)"),
    targetBranch: z.string().describe("Rama destino del merge (ej: 'dev', 'main')"),
  },
  async ({ type, targetBranch }) => {
    const result = await registerMerge(type as MergeType, targetBranch);
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

// ─── Tool 11: sdd_confirm_next ───────────────────────────────────────────────

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

// ─── Tool 12: sdd_transition_ticket (+ alias sdd_transition_jira) ────────────

const VALID_STATES_FOR_TICKET_TRANSITION = [
  PipelineState.COMMIT,
  PipelineState.COMPLETADO,
];

const transitionTicketHandler = async ({ ticketId }: { ticketId: string }) => {
  const data = await loadState();
  if (!VALID_STATES_FOR_TICKET_TRANSITION.includes(data.state)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: false,
            error: `No se puede transicionar a QA desde el estado ${data.state}. Se requiere completar el ciclo: IMPLEMENTACION → EVIDENCIA → COMMIT antes de transicionar. Estados válidos: [${VALID_STATES_FOR_TICKET_TRANSITION.join(", ")}].`,
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
};

const transitionTicketSchema = {
  ticketId: z.string().describe("ID del ticket a transicionar (ej: AUTH-45, PROJ-1)"),
};

server.tool(
  "sdd_transition_ticket",
  "Genera instrucciones para transicionar un ticket a QA Review usando el MCP del tracker configurado (Jira o Notion). SOLO válido en estado COMMIT o COMPLETADO.",
  transitionTicketSchema,
  transitionTicketHandler,
);

// Backwards-compat alias for projects already bootstrapped with sdd_transition_jira
server.tool(
  "sdd_transition_jira",
  "Alias de sdd_transition_ticket — genera instrucciones para transicionar un ticket a QA Review. SOLO válido en estado COMMIT o COMPLETADO.",
  transitionTicketSchema,
  transitionTicketHandler,
);

// ─── Tool 13: sdd_comment_ticket (+ alias sdd_comment_jira) ─────────────────

const VALID_STATES_FOR_TICKET_COMMENT = [
  PipelineState.COMMIT,
  PipelineState.COMPLETADO,
];

const commentTicketHandler = async ({ ticketId, body }: { ticketId: string; body: string }) => {
  const data = await loadState();
  if (!VALID_STATES_FOR_TICKET_COMMENT.includes(data.state)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: false,
            error: `No se puede comentar en el tracker desde el estado ${data.state}. Se requiere completar el ciclo: IMPLEMENTACION → EVIDENCIA → COMMIT antes de comentar. Estados válidos: [${VALID_STATES_FOR_TICKET_COMMENT.join(", ")}].`,
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
};

const commentTicketSchema = {
  ticketId: z.string().describe("ID del ticket (ej: AUTH-45, PROJ-1)"),
  body: z.string().describe("Contenido del comentario"),
};

server.tool(
  "sdd_comment_ticket",
  "Genera instrucciones para agregar un comentario a un ticket usando el MCP del tracker configurado (Jira o Notion). SOLO válido en estado COMMIT o COMPLETADO.",
  commentTicketSchema,
  commentTicketHandler,
);

// Backwards-compat alias for projects already bootstrapped with sdd_comment_jira
server.tool(
  "sdd_comment_jira",
  "Alias de sdd_comment_ticket — genera instrucciones para comentar un ticket. SOLO válido en estado COMMIT o COMPLETADO.",
  commentTicketSchema,
  commentTicketHandler,
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
