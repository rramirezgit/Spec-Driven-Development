const JIRA_EMAIL = process.env.JIRA_EMAIL ?? "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";

function authHeader(): string {
  return `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`;
}

function jiraBaseUrl(cloudId: string): string {
  return `https://api.atlassian.net/ex/jira/${cloudId}/rest/api/3`;
}

interface JiraTransition {
  id: string;
  name: string;
}

export async function findQATransition(
  cloudId: string,
  ticketId: string,
): Promise<JiraTransition | null> {
  const url = `${jiraBaseUrl(cloudId)}/issue/${ticketId}/transitions`;
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Jira API error ${res.status}: ${await res.text()}`,
    );
  }

  const data = (await res.json()) as {
    transitions: JiraTransition[];
  };
  const qaNames = ["qa review", "qa", "in review", "review", "ready for qa"];
  return (
    data.transitions.find((t) =>
      qaNames.includes(t.name.toLowerCase()),
    ) ?? null
  );
}

export async function transitionToQA(
  cloudId: string,
  ticketId: string,
): Promise<{ ok: boolean; transitioned: boolean; status?: string; error?: string }> {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    return {
      ok: false,
      transitioned: false,
      error:
        "JIRA_EMAIL y/o JIRA_API_TOKEN no configurados. Configurá las variables de entorno.",
    };
  }

  try {
    const transition = await findQATransition(cloudId, ticketId);
    if (!transition) {
      return {
        ok: true,
        transitioned: false,
        error: `No se encontró transición a QA Review para ${ticketId}. Transicionar manualmente.`,
      };
    }

    const url = `${jiraBaseUrl(cloudId)}/issue/${ticketId}/transitions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transition: { id: transition.id } }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        transitioned: false,
        error: `Error al transicionar ${ticketId}: ${res.status} — ${body}`,
      };
    }

    return {
      ok: true,
      transitioned: true,
      status: transition.name,
    };
  } catch (err) {
    return {
      ok: false,
      transitioned: false,
      error: `Error de conexión con Jira: ${(err as Error).message}`,
    };
  }
}

export async function addComment(
  cloudId: string,
  ticketId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    return {
      ok: false,
      error: "JIRA_EMAIL y/o JIRA_API_TOKEN no configurados.",
    };
  }

  try {
    const url = `${jiraBaseUrl(cloudId)}/issue/${ticketId}/comment`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: body }],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Error al comentar en ${ticketId}: ${res.status} — ${text}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Error de conexión con Jira: ${(err as Error).message}`,
    };
  }
}
