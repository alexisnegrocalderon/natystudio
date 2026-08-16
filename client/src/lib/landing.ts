export const WHATSAPP_URL = "https://wa.me/message/BEZLWH4LIT2PM1";
export const INSTAGRAM_URL = "https://www.instagram.com/naty.studiovalparaiso/";

export const COURSE_SECTION_ID = "curso";

export const whatsappWithMessage = (message: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;

export function getPilotCatalogState({
  isLoading,
  isError,
  hasService,
}: {
  isLoading: boolean;
  isError: boolean;
  hasService: boolean;
}) {
  if (isLoading) return "loading" as const;
  if (isError) return "fallback" as const;
  if (!hasService) return "empty" as const;
  return "ready" as const;
}

export function getPilotCatalogSourceLabel(state: ReturnType<typeof getPilotCatalogState>) {
  return state === "ready" ? "STAGING" : "PREVIEW";
}
