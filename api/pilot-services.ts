import { neon } from "@neondatabase/serverless";

type ApiRequest = { method?: string };
type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

type PilotService = {
  slug: string;
  name: string;
  description: string;
  priceNote: string;
  durationNote: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    res.status(503).json({ error: "pilot_database_not_configured" });
    return;
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT slug, name, description, price_note AS "priceNote", duration_note AS "durationNote"
      FROM pilot_services
      WHERE enabled = TRUE
      ORDER BY id ASC
    `;

    const services: PilotService[] = rows.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      priceNote: String(row.priceNote),
      durationNote: String(row.durationNote),
    }));

    res.status(200).json({ services });
  } catch {
    res.status(502).json({ error: "pilot_catalog_unavailable" });
  }
}
