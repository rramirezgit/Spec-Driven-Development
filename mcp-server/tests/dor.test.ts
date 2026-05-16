import { describe, it, expect } from "vitest";
import { validateTicketDor } from "../src/pipeline.js";

/**
 * Tests para el validador puro de DoR (V4.18).
 * No tocan filesystem ni state — solo verifican la lógica de detección de
 * secciones y reglas por sección.
 *
 * El validador es deliberadamente conservador: errores solo cuando hay
 * incumplimiento claro (sección ausente, count debajo del mínimo, "nada"
 * en out-of-scope). Warnings para issues que el dev puede legítimamente
 * dejar (lenguaje vago en AC, DoR con <3 items).
 */

const TICKET_OK = `**Como** usuario nuevo
**Quiero** iniciar sesión con Google
**Para** evitar crear una contraseña

## Objetivo
Permitir login con Google para reducir fricción de signup (meta: drop-off del 40% al 25%).

## Contexto técnico
- Módulos: auth/oauth/, auth/jwt/
- Patrones: auth/oauth/facebook.ts como referencia
- Servicios externos: Google OAuth API

## Criterios de aceptación
- [ ] Dado un usuario sin cuenta, cuando completa OAuth con Google, entonces se crea cuenta con email del claim
- [ ] Dado un usuario con cuenta email/password preexistente, cuando intenta Google OAuth con mismo email, entonces se le pide confirmar merge

## Fuera de scope
- Merge de cuentas existentes (otro ticket)
- Login con Apple

## Dependencias
- Tickets bloqueantes: ninguno
- Servicios externos: credentials de Google Console

## Riesgos
- Email no verified en claim → no auto-confirmar
- Race condition en provider_id duplicado

## Test cases declarados
- Golden path: usuario nuevo → cuenta creada + JWT
- Edge: email no verified → 400 con mensaje
- Edge: provider_id duplicado → 409 idempotente

## Definition of Done
- [ ] Código mergeado a dev
- [ ] Tests declarados pasan
- [ ] Feature flag ENABLE_GOOGLE_LOGIN agregada
`;

describe("validateTicketDor — golden path", () => {
  it("acepta un ticket completo sin errors ni warnings", () => {
    const result = validateTicketDor(TICKET_OK);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    // Las 8 secciones presentes
    expect(result.sections.objetivo.present).toBe(true);
    expect(result.sections.contextoTecnico.present).toBe(true);
    expect(result.sections.criteriosAceptacion.present).toBe(true);
    expect(result.sections.fueraDeScope.present).toBe(true);
    expect(result.sections.dependencias.present).toBe(true);
    expect(result.sections.riesgos.present).toBe(true);
    expect(result.sections.testCases.present).toBe(true);
    expect(result.sections.definitionOfDone.present).toBe(true);
  });
});

describe("validateTicketDor — secciones ausentes", () => {
  it("flaggea Objetivo ausente como error", () => {
    const body = TICKET_OK.replace(/## Objetivo[\s\S]*?(?=\n## )/, "");
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Objetivo/i.test(e))).toBe(true);
  });

  it("flaggea Test cases ausentes como error", () => {
    const body = TICKET_OK.replace(/## Test cases declarados[\s\S]*?(?=\n## )/, "");
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Test cases/i.test(e))).toBe(true);
  });

  it("listа múltiples ausencias en orden", () => {
    const body = `**Como** usuario\n**Quiero** algo\n**Para** beneficio\n`;
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    // Todas las 8 secciones faltan
    expect(result.errors.length).toBeGreaterThanOrEqual(8);
  });
});

describe("validateTicketDor — criterios de aceptación", () => {
  it("rechaza menos de 2 AC", () => {
    const body = TICKET_OK.replace(
      /## Criterios de aceptación[\s\S]*?(?=\n## )/,
      "## Criterios de aceptación\n- [ ] Dado X, cuando Y, entonces Z\n\n",
    );
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Criterios de aceptación/i.test(e))).toBe(true);
  });

  it("detecta lenguaje vago en AC como warning", () => {
    const body = TICKET_OK.replace(
      /## Criterios de aceptación[\s\S]*?(?=\n## )/,
      "## Criterios de aceptación\n" +
        "- [ ] El usuario puede loguearse correctamente\n" +
        "- [ ] La UI es intuitiva\n\n",
    );
    const result = validateTicketDor(body);
    // No bloquea (count >= 2)
    expect(result.sections.criteriosAceptacion.count).toBe(2);
    // Pero advierte
    expect(result.warnings.some((w) => /vago|metric/i.test(w))).toBe(true);
    expect(result.sections.criteriosAceptacion.vagueMatches?.length).toBeGreaterThan(0);
  });

  it("acepta AC con condiciones observables y métricas", () => {
    const body = TICKET_OK.replace(
      /## Criterios de aceptación[\s\S]*?(?=\n## )/,
      "## Criterios de aceptación\n" +
        "- [ ] Dado un usuario válido, cuando POST /sessions, entonces responde 201 con token JWT en <200ms p95\n" +
        "- [ ] Dado token expirado, cuando GET /me, entonces responde 401 con error 'expired'\n\n",
    );
    const result = validateTicketDor(body);
    expect(result.warnings.length).toBe(0);
  });
});

describe("validateTicketDor — fuera de scope", () => {
  it("rechaza out-of-scope vacío", () => {
    const body = TICKET_OK.replace(
      /## Fuera de scope[\s\S]*?(?=\n## )/,
      "## Fuera de scope\n\n",
    );
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Fuera de scope/i.test(e))).toBe(true);
  });

  it("rechaza out-of-scope con 'nada' / 'ninguno'", () => {
    const body = TICKET_OK.replace(
      /## Fuera de scope[\s\S]*?(?=\n## )/,
      "## Fuera de scope\n- nada\n\n",
    );
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /nada|ninguno|N\/A/i.test(e))).toBe(true);
  });
});

describe("validateTicketDor — test cases", () => {
  it("rechaza menos de 3 test cases", () => {
    const body = TICKET_OK.replace(
      /## Test cases declarados[\s\S]*?(?=\n## )/,
      "## Test cases declarados\n- Golden: caso feliz\n- Edge: error\n\n",
    );
    const result = validateTicketDor(body);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /Test cases/i.test(e))).toBe(true);
  });
});

describe("validateTicketDor — definition of done", () => {
  it("warnea cuando DoD tiene <3 items (no bloquea)", () => {
    const body = TICKET_OK.replace(
      /## Definition of Done[\s\S]*$/,
      "## Definition of Done\n- [ ] Código mergeado\n",
    );
    const result = validateTicketDor(body);
    // No error (presente)
    expect(result.sections.definitionOfDone.present).toBe(true);
    // Pero warning sobre count
    expect(result.warnings.some((w) => /Definition of Done/i.test(w))).toBe(true);
  });
});

describe("validateTicketDor — soporte de idioma", () => {
  it("acepta headers en inglés", () => {
    const bodyEN = `## Goal
Reduce signup friction.

## Technical context
- Modules: auth/oauth
- Patterns: see auth/oauth/facebook.ts

## Acceptance criteria
- [ ] Given a new user, when they complete Google OAuth, then account is created
- [ ] Given existing user, when same email Google OAuth, then merge prompt

## Out of scope
- Account merging UI (separate ticket)

## Dependencies
- Blocking tickets: none

## Risks
- Race condition in provider_id

## Test cases
- Golden path: new user → account created
- Edge 1: email not verified → 400
- Edge 2: duplicate provider_id → 409

## Definition of Done
- [ ] Code merged to dev
- [ ] Tests passing
- [ ] Feature flag added
`;
    const result = validateTicketDor(bodyEN);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
