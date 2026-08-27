import { parse, serialize, type SerializeOptions } from "cookie";

/**
 * Fija una cookie sobre un objeto `Headers` de la Fetch API.
 *
 * El adaptador fetch de tRPC no expone `res.cookie()` como Express — sólo un
 * `Headers` al que hay que anexarle `Set-Cookie`. `Headers.append` sí admite
 * varias apariciones de la misma cabecera (a diferencia de `set`, que
 * sobreescribiría una cookie previa), que es lo que exige el estándar cuando
 * una respuesta fija más de una cookie.
 */
export function setCookie(
  resHeaders: Headers,
  name: string,
  value: string,
  options: SerializeOptions = {},
): void {
  resHeaders.append("set-cookie", serialize(name, value, options));
}

export function clearCookie(resHeaders: Headers, name: string, options: SerializeOptions = {}): void {
  resHeaders.append("set-cookie", serialize(name, "", { ...options, maxAge: 0 }));
}

/** Lee una cookie de un `Request` entrante — para rutas fuera de tRPC que no pasan por `createContext`. */
export function readCookie(req: Request, name: string): string | undefined {
  return parse(req.headers.get("cookie") ?? "")[name];
}
