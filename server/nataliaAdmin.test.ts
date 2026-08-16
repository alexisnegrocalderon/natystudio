import { describe, expect, it } from "vitest";
import { hashPortalPassword, verifyPortalPassword } from "./nataliaAdmin";

describe("natalia admin credentials", () => {
  it("hashes and verifies a portal password without retaining plaintext", async () => {
    const password = "PortalSeguro2026!";
    const hash = await hashPortalPassword(password);
    expect(hash).not.toContain(password);
    await expect(verifyPortalPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPortalPassword("ClaveIncorrecta2026!", hash)).resolves.toBe(false);
  });

  it("requires a long password for the owner account", async () => {
    await expect(hashPortalPassword("corta")).rejects.toThrow("al menos 12 caracteres");
  });
});
