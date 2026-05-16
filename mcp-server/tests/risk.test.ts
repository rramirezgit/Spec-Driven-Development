import { describe, it, expect } from "vitest";
import { classifyRisk } from "../src/pipeline.js";

/**
 * Tests para el clasificador de riesgo puro (V4.19).
 *
 * Diseño: conservador. Preferir falsos positivos (clasificar high algo medium)
 * a falsos negativos (clasificar low algo alto). El user puede degradar
 * manualmente si discrepa, pero un auth bug auto-mergeado no es recuperable.
 */

describe("classifyRisk — high triggers por path", () => {
  it("auth/ → high", () => {
    const r = classifyRisk({ paths: ["src/auth/oauth.ts"] });
    expect(r.level).toBe("high");
    expect(r.reasons.some((reason) => /auth/i.test(reason))).toBe(true);
  });

  it("payment paths → high", () => {
    expect(classifyRisk({ paths: ["src/payment/stripe.ts"] }).level).toBe("high");
    expect(classifyRisk({ paths: ["billing/invoice.ts"] }).level).toBe("high");
  });

  it("migrations → high", () => {
    expect(classifyRisk({ paths: ["prisma/migrations/20260101.sql"] }).level).toBe("high");
    expect(classifyRisk({ paths: ["db/migration/users.sql"] }).level).toBe("high");
  });

  it("secrets / crypto → high", () => {
    expect(classifyRisk({ paths: ["src/crypto/aes.ts"] }).level).toBe("high");
    expect(classifyRisk({ paths: ["secrets/keys.ts"] }).level).toBe("high");
  });

  it("cron / worker / scheduler → high", () => {
    expect(classifyRisk({ paths: ["src/cron/cleanup.ts"] }).level).toBe("high");
    expect(classifyRisk({ paths: ["worker/jobs.ts"] }).level).toBe("high");
    expect(classifyRisk({ paths: ["scheduler/index.ts"] }).level).toBe("high");
  });

  it("webhook → high", () => {
    expect(classifyRisk({ paths: ["src/webhooks/stripe.ts"] }).level).toBe("high");
  });
});

describe("classifyRisk — high triggers por keyword en descripción", () => {
  it("breaking → high", () => {
    expect(
      classifyRisk({
        paths: ["src/utils/format.ts"],
        description: "breaking change in response shape",
      }).level,
    ).toBe("high");
  });

  it("delete all → high", () => {
    expect(
      classifyRisk({
        paths: ["src/admin/cleanup.ts"],
        description: "delete all users older than 365 days",
      }).level,
    ).toBe("high");
  });

  it("drop table → high", () => {
    expect(
      classifyRisk({ description: "drop table sessions and recreate with new schema" }).level,
    ).toBe("high");
  });

  it("rotation / expire → high (auth-related)", () => {
    expect(classifyRisk({ description: "implement key rotation" }).level).toBe("high");
    expect(classifyRisk({ description: "refresh tokens expire after 24h" }).level).toBe("high");
  });
});

describe("classifyRisk — medium triggers", () => {
  it("api/ sin auth → medium", () => {
    const r = classifyRisk({ paths: ["src/api/users.ts"] });
    expect(r.level).toBe("medium");
  });

  it("components/ → medium", () => {
    expect(classifyRisk({ paths: ["src/components/Button.tsx"] }).level).toBe("medium");
  });

  it("hooks/ → medium", () => {
    expect(classifyRisk({ paths: ["src/hooks/useUser.ts"] }).level).toBe("medium");
  });

  it("services/ → medium", () => {
    expect(classifyRisk({ paths: ["src/services/notifications.ts"] }).level).toBe("medium");
  });

  it("screens / pages → medium", () => {
    expect(classifyRisk({ paths: ["app/pages/dashboard.tsx"] }).level).toBe("medium");
    expect(classifyRisk({ paths: ["src/screens/Profile.tsx"] }).level).toBe("medium");
  });
});

describe("classifyRisk — low (default)", () => {
  it("utils sin keywords → low", () => {
    const r = classifyRisk({ paths: ["src/utils/format-date.ts"] });
    expect(r.level).toBe("low");
  });

  it("types sin keywords → low", () => {
    expect(classifyRisk({ paths: ["src/types/index.ts"] }).level).toBe("low");
  });

  it("test fixtures → low", () => {
    expect(classifyRisk({ paths: ["__tests__/fixtures/user.ts"] }).level).toBe("low");
  });

  it("vacío → low (no paths, no description)", () => {
    expect(classifyRisk({}).level).toBe("low");
  });

  it("description benigna → low", () => {
    expect(
      classifyRisk({
        paths: ["src/utils/helpers.ts"],
        description: "agregar utility function para formatear fechas",
      }).level,
    ).toBe("low");
  });
});

describe("classifyRisk — prevalencia high > medium > low", () => {
  it("mix high + medium → high (high gana)", () => {
    const r = classifyRisk({
      paths: ["src/api/users.ts", "src/auth/middleware.ts"],
    });
    expect(r.level).toBe("high");
  });

  it("mix medium + low → medium (medium gana)", () => {
    const r = classifyRisk({
      paths: ["src/utils/helpers.ts", "src/api/users.ts"],
    });
    expect(r.level).toBe("medium");
  });

  it("paths inocuos + keyword high → high (keyword en desc gana)", () => {
    const r = classifyRisk({
      paths: ["src/utils/format.ts"],
      description: "this is a breaking change",
    });
    expect(r.level).toBe("high");
  });
});

describe("classifyRisk — reasons explican la clasificación", () => {
  it("incluye el token específico que disparó", () => {
    const r = classifyRisk({ paths: ["src/payment/stripe.ts"] });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.some((reason) => /payment/i.test(reason))).toBe(true);
  });

  it("low retorna razón explícita (no string vacío)", () => {
    const r = classifyRisk({ paths: ["src/utils/x.ts"] });
    expect(r.level).toBe("low");
    expect(r.reasons.length).toBeGreaterThan(0);
  });
});
