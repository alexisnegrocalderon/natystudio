import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createPilotBooking, getPilotOverview, listPilotServices, normalizeWhatsApp } from "./nataliaPilot";

const bookingSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(7).max(32).transform(normalizeWhatsApp),
  serviceSlug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().max(1_200).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  nataliaPilot: router({
    services: publicProcedure.query(() => listPilotServices()),
    overview: publicProcedure.query(() => getPilotOverview()),
    reserve: publicProcedure.input(bookingSchema).mutation(({ input }) => createPilotBooking(input)),
  }),
});

export type AppRouter = typeof appRouter;
