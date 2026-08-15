export const WHATSAPP_URL = "https://wa.me/message/BEZLWH4LIT2PM1";
export const INSTAGRAM_URL = "https://www.instagram.com/naty.studiovalparaiso/";

export const whatsappWithMessage = (message: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;

