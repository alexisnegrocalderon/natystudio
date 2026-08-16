import { describe, expect, it } from "vitest";
import { loginNataliaAdmin } from "./nataliaAdminApi";
import { seedNataliaAdminUser } from "./nataliaAdmin";

const nataliaEmail = "studio.nataliarodriguez@gmail.com";

type MockResponse = {
  statusCode: number;
  body: unknown;
  cookie: string | undefined;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(payload: unknown): void;
};

function createResponse(): MockResponse {
  return {
    statusCode: 0,
    body: undefined,
    cookie: undefined,
    setHeader(name, value) {
      if (name === "Set-Cookie") this.cookie = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
    },
  };
}

describe("natalia admin initial credential", () => {
  it("creates the staging owner and authenticates through the private login API", async () => {
    const password = process.env.NATALIA_ADMIN_INITIAL_PASSWORD;
    expect(password).toBeTruthy();
    expect(password!.length).toBeGreaterThanOrEqual(12);

    await seedNataliaAdminUser(nataliaEmail, password!);
    const response = createResponse();
    await loginNataliaAdmin({ method: "POST", body: { email: nataliaEmail, password }, headers: {} }, response);

    expect(response.statusCode).toBe(200);
    expect(response.cookie).toContain("natalia_admin_session=");
    expect(response.body).toMatchObject({ user: { email: nataliaEmail, role: "owner" } });
  }, 15_000);
});
