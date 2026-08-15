import { z } from "zod";
import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import { db, posts } from "../db";
import { publicProcedure, router } from "../trpc";

/** Un artículo es público sólo si tiene fecha de publicación y ya pasó. */
const isPublished = () => and(isNotNull(posts.publishedAt), lte(posts.publishedAt, new Date()));

export const contentRouter = router({
  listPosts: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return db
        .select({
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          coverImageUrl: posts.coverImageUrl,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(isPublished())
        .orderBy(desc(posts.publishedAt))
        .limit(input?.limit ?? 20);
    }),

  getPost: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const rows = await db
      .select()
      .from(posts)
      .where(and(eq(posts.slug, input.slug), isPublished()))
      .limit(1);

    return rows[0] ?? null;
  }),
});
