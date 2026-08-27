import { ENV } from "../env";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Sin GEMINI_API_KEY los botones de IA se apagan solos, no rompen el resto del panel. */
export const aiEnabled = Boolean(ENV.geminiApiKey);

type ContentPart = { text: string } | { inline_data: { mime_type: string; data: string } };

async function generateText(parts: ContentPart[], temperature = 0.6): Promise<string> {
  if (!ENV.geminiApiKey) {
    throw new Error("La redacción con IA no está configurada todavía (falta GEMINI_API_KEY).");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${ENV.geminiModel}:generateContent?key=${ENV.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature },
      }),
    });
  } catch (error) {
    throw new Error(`No se pudo contactar a Gemini: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini rechazó la solicitud (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini no devolvió texto.");
  return text.trim();
}

const BUSINESS_CONTEXT =
  "naty.studio, un negocio de enfermería estética en Chile (sedes en Valparaíso y Providencia) " +
  "especializado en retiro de acrocordones y formación para profesionales de la salud.";

function parseTagged(raw: string, tags: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const nextTag = tags[i + 1];
    const pattern = nextTag
      ? new RegExp(`${tag}:\\s*([\\s\\S]*?)(?=\\n${nextTag}:)`, "i")
      : new RegExp(`${tag}:\\s*([\\s\\S]+)`, "i");
    result[tag] = raw.match(pattern)?.[1]?.trim() ?? "";
  }
  return result;
}

export async function draftEmail(input: {
  idea: string;
  audience: "clienta" | "interesada";
  recipientName?: string;
}): Promise<{ subject: string; body: string }> {
  const audienceContext =
    input.audience === "clienta"
      ? "una clienta que ya reservó o se atendió antes con Naty"
      : "una persona interesada que dejó sus datos pero todavía no ha reservado una hora";

  const prompt = `Eres la asistente de redacción de ${BUSINESS_CONTEXT}
Redacta un correo breve, cálido y profesional en español de Chile, dirigido a ${audienceContext}${
    input.recipientName ? ` (se llama ${input.recipientName})` : ""
  }.

Idea del mensaje, tal como la escribió Naty: "${input.idea}"

Responde EXCLUSIVAMENTE en este formato, sin explicaciones adicionales ni markdown:
ASUNTO: <asunto breve, sin comillas>
CUERPO: <cuerpo del correo, párrafos separados por una línea en blanco, sin firma ni "Atentamente">`;

  const raw = await generateText([{ text: prompt }]);
  const { ASUNTO, CUERPO } = parseTagged(raw, ["ASUNTO", "CUERPO"]);
  return {
    subject: ASUNTO || "Un mensaje de naty.studio",
    body: CUERPO || raw,
  };
}

export async function draftServiceDescription(input: {
  name: string;
  notes?: string;
  photoBase64?: string;
  photoMimeType?: string;
}): Promise<{ shortDescription: string; longDescription: string }> {
  const prompt = `Eres la asistente de redacción de ${BUSINESS_CONTEXT} El tono es cercano, profesional y honesto, sin promesas médicas exageradas.
Redacta la descripción de un servicio nuevo llamado "${input.name}"${
    input.notes ? `. Notas que dejó Naty sobre el servicio: "${input.notes}"` : ""
  }${input.photoBase64 ? ". Se adjunta una foto de referencia del servicio: descríbelo tomando en cuenta lo que se ve, sin inventar procedimientos que no correspondan." : ""}

Responde EXCLUSIVAMENTE en este formato, sin explicaciones adicionales ni markdown:
CORTA: <descripción de 1-2 oraciones, máximo 160 caracteres, sin comillas>
LARGA: <descripción más completa, 2-3 párrafos separados por una línea en blanco>`;

  const parts: ContentPart[] = [{ text: prompt }];
  if (input.photoBase64 && input.photoMimeType) {
    parts.push({ inline_data: { mime_type: input.photoMimeType, data: input.photoBase64 } });
  }

  const raw = await generateText(parts);
  const { CORTA, LARGA } = parseTagged(raw, ["CORTA", "LARGA"]);
  return { shortDescription: CORTA, longDescription: LARGA };
}
