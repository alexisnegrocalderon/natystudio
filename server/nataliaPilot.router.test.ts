import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("nataliaPilot router", () => {
  it("returns the staging catalogue and overview through the public API contract", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const [services, overview] = await Promise.all([caller.nataliaPilot.services(), caller.nataliaPilot.overview()]);

    expect(services[0]).toMatchObject({ slug: "retiro-acrocordones" });
    expect(overview).toMatchObject({ activeServices: 1, pendingBookings: 0 });
  }, 15_000);

  it("rejects malformed booking input before any database write", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(
      caller.nataliaPilot.reserve({
        fullName: "N",
        whatsapp: "123",
        serviceSlug: "retiro-acrocordones",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
