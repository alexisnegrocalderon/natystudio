# Notas de preview Vercel — Natalia Rodríguez Studio

## Hallazgos del 16 de agosto de 2026

| Elemento | Estado | Acción aplicada |
|---|---|---|
| Rama de preview | `preview/natalia-pilot` | Publicada sin modificar `main`. |
| Root Directory heredada | `apps/web` | Debe utilizar la raíz del repositorio (`.` o vacío), porque el piloto reside en el root y allí está `pnpm-lock.yaml`. |
| Framework Preset heredado | Next.js | Debe configurarse como Vite u Other, ya que el proyecto no tiene dependencia de Next.js. |
| API de preview | Funciones serverless específicas | `/api/pilot-services` devuelve catálogo desde Neon staging y `/api/health` confirma disponibilidad. |
| Protección | Vercel SSO activa | Mantenerla activa; los checks anónimos redirigen al inicio de sesión. |
| Entorno de base de datos | `NEON_DATABASE_URL` en Preview | Debe contener la cadena pooled de `retiro-acrocordones` → `staging`, exclusivamente en el entorno Preview. |

## Decisión técnica

La primera aproximación de importar el servidor Express completo no fue compatible con la verificación de TypeScript de Vercel, porque incorporaba módulos de la infraestructura administrada de Manus. Se sustituyó por funciones serverless mínimas y tipadas. La landing intenta primero el API interno durante el desarrollo administrado; cuando éste no está disponible en Vercel, usa el endpoint serverless same-origin de catálogo.

## Validación de preview aportada por el usuario

El 16 de agosto de 2026, el propietario abrió el alias protegido del preview en Safari y confirmó estas respuestas JSON:

| Ruta | Respuesta observada | Resultado |
|---|---|---|
| `/api/health` | `{ "service": "natalia-pilot-preview", "status": "ready" }` | La función de salud serverless está disponible. |
| `/api/pilot-services` | Un arreglo con el servicio `retiro-acrocordones`, su descripción, nota de precio y duración. | El catálogo same-origin está leyendo la configuración de staging prevista. |

La comprobación pendiente es abrir los CTAs de reserva y contacto dentro del preview y confirmar que ambos apuntan a WhatsApp.

## Referencias oficiales

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express): detalla el modelo de Express como función y sus limitaciones con recursos estáticos.
- [Vercel Functions](https://vercel.com/docs/functions): describe funciones bajo `api/**`, su escalado y el uso de handlers serverless.
