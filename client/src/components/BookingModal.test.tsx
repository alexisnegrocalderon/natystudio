// @vitest-environment jsdom

import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingModal } from "./BookingModal";

const service = {
  slug: "evaluacion",
  name: "Evaluación personalizada",
  description: "Revisión inicial.",
  priceNote: "Valor informado",
  durationNote: "30 minutos",
};

function response(payload: unknown) {
  return { ok: true, json: async () => payload } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookingModal", () => {
  it("renderiza el primer paso con el servicio disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ slots: [] })));

    render(<BookingModal open onOpenChange={() => undefined} services={[service]} />);

    expect(await screen.findByText("1. Elige tu atención")).toBeTruthy();
    expect(screen.getByRole("button", { name: /evaluación personalizada/i })).toBeTruthy();
    expect(screen.getByText("Valor informado · 30 minutos")).toBeTruthy();
  });

  it("avanza desde servicio y horario hasta los campos de datos etiquetados", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ slots: [{ id: 1, startsAt: "2026-08-21T14:00:00.000Z", endsAt: "2026-08-21T14:30:00.000Z" }] }))
      .mockResolvedValueOnce(response({ hold: { id: 1, startsAt: "2026-08-21T14:00:00.000Z", endsAt: "2026-08-21T14:30:00.000Z", holdToken: "token-de-prueba", holdExpiresAt: "2026-08-21T14:15:00.000Z" } })));
    const user = userEvent.setup();

    render(<BookingModal open onOpenChange={() => undefined} services={[service]} />);
    await user.click(await screen.findByRole("button", { name: /evaluación personalizada/i }));
    expect(await screen.findByText("2. Elige tu horario")).toBeTruthy();

    const slot = await screen.findByRole("button", { name: /2026/ });
    await user.click(slot);

    await waitFor(() => expect(screen.getByText("3. Confirma tus datos")).toBeTruthy());
    expect(screen.getByLabelText("Nombre y apellido")).toBeTruthy();
    expect(screen.getByLabelText("Correo electrónico")).toBeTruthy();
    expect(screen.getByLabelText("WhatsApp o teléfono")).toBeTruthy();
    expect(screen.getByLabelText("Comentario opcional")).toBeTruthy();
  });
});
