/**
 * Límite simple en memoria, por instancia. En un entorno serverless cada
 * instancia fría tiene su propio conteo, así que esto es una barrera blanda,
 * no una garantía dura — alcanza para frenar un envío accidental repetido o
 * un bot torpe, sin necesitar un captcha externo ni una tabla en la base.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(timestamp => now - timestamp < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
