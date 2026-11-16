import { describe, expect, it } from "vitest";
import { fromSantiagoInput, toSantiagoInput } from "./santiago";

describe("hora de Chile para los campos de fecha", () => {
  it("en verano (UTC-3) las 15:00 UTC son las 12:00 en Santiago", () => {
    expect(toSantiagoInput(new Date("2026-11-17T15:00:00Z"))).toBe("2026-11-17T12:00");
  });

  it("en invierno (UTC-4) las 16:00 UTC son las 12:00 en Santiago", () => {
    expect(toSantiagoInput(new Date("2026-07-15T16:00:00Z"))).toBe("2026-07-15T12:00");
  });

  it("ida y vuelta devuelve el mismo instante", () => {
    for (const iso of ["2026-11-17T15:00:00.000Z", "2026-07-15T16:30:00.000Z", "2026-01-05T02:15:00.000Z"]) {
      expect(fromSantiagoInput(toSantiagoInput(new Date(iso)))?.toISOString()).toBe(iso);
    }
  });

  it("escribir 10:00 en Santiago en noviembre da las 13:00 UTC", () => {
    expect(fromSantiagoInput("2026-11-20T10:00")?.toISOString()).toBe("2026-11-20T13:00:00.000Z");
  });

  it("un texto inválido devuelve null", () => {
    expect(fromSantiagoInput("")).toBeNull();
    expect(fromSantiagoInput("mañana")).toBeNull();
  });
});
