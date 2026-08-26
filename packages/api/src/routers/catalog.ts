import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, locations, services } from "../db";
import { publicProcedure, router } from "../trpc";

const publicLocationColumns = {
  id: locations.id,
  slug: locations.slug,
  name: locations.name,
  city: locations.city,
  region: locations.region,
  streetAddress: locations.streetAddress,
  latitude: locations.latitude,
  longitude: locations.longitude,
  whatsapp: locations.whatsapp,
  note: locations.note,
};

/** Sólo los campos que el sitio público necesita. */
const publicColumns = {
  id: services.id,
  slug: services.slug,
  name: services.name,
  shortDescription: services.shortDescription,
  longDescription: services.longDescription,
  kind: services.kind,
  durationMin: services.durationMin,
  priceClp: services.priceClp,
  depositClp: services.depositClp,
  imageUrl: services.imageUrl,
  metaTitle: services.metaTitle,
  metaDescription: services.metaDescription,
  updatedAt: services.updatedAt,
};

export const catalogRouter = router({
  listServices: publicProcedure
    .input(z.object({ kind: z.enum(["service", "course"]).optional() }).optional())
    .query(async ({ input }) => {
      const conditions = [eq(services.active, true)];
      if (input?.kind) conditions.push(eq(services.kind, input.kind));

      return db
        .select(publicColumns)
        .from(services)
        .where(and(...conditions))
        .orderBy(asc(services.sortOrder), asc(services.id));
    }),

  getService: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const rows = await db
      .select(publicColumns)
      .from(services)
      .where(and(eq(services.slug, input.slug), eq(services.active, true)))
      .limit(1);

    return rows[0] ?? null;
  }),

  listLocations: publicProcedure.query(() =>
    db
      .select(publicLocationColumns)
      .from(locations)
      .where(eq(locations.active, true))
      .orderBy(asc(locations.sortOrder), asc(locations.id)),
  ),
});
