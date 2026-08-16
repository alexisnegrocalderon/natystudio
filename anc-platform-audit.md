# Auditoría de traspaso — Natalia Rodríguez Studio / ANC Platform

**Fecha de auditoría:** 16 de agosto de 2026. Esta revisión fue únicamente de lectura: no creó recursos, no modificó integraciones de pago, no activó secretos y no inició aprovisionamiento.

## Hallazgos verificados

| Área | Estado observado | Evidencia |
|---|---|---|
| Frontend de Natalia | Existe en GitHub como `alexisnegrocalderon/natystudio`, rama `main`. | Repositorio actualizado el 15 de agosto de 2026; el código actual es una landing visual independiente. |
| Proyecto Vercel de Natalia | No apareció en el equipo Vercel conectado. | El único proyecto listado fue `anc-solutions-website`. No se creó un duplicado. |
| Proyecto Vercel confirmado por usuario | Existe como `natystudio` y está vinculado a `alexisnegrocalderon/natystudio`. | ID aportado: `prj_rp6FRNWyhdrSRvsA2oTqcnGwohYE`. La consulta de la integración disponible devolvió 404, por lo que su cuenta o alcance no puede leer todavía este proyecto. |
| Admin ANC en Vercel | `anc-solutions-website` está en producción desde la rama `main`. | Proyecto `prj_lMpkXfX39oMzmQM3Mb1sDN79N6h1`; el último despliegue listo usa el commit `7f647f75a48cebe03200d584f33440afbb47c81a`. |
| Dominios del Admin | `www.ancdigital.cl`, `ancdigital.cl` y dominios Vercel del Admin están configurados. | Metadatos de Vercel del proyecto auditado. |
| Rutas de Platform Factory en el código | El Admin en GitHub sí registra `platformFactory` y contiene `blueprints.list` y `provisioning.list`. | `server/routers.ts` y `server/routers/platformFactory.ts` de la rama `main`. |
| Backend efectivo del Admin | El frontend Vercel redirige `/api/*` a `https://ancsolutions-2uzgqg3g.manus.space/api/$1`. | `vercel.json` del Admin. |
| Bloqueo de Platform Factory | El backend remoto no reconoce la ruta de lectura de blueprints. | La consulta de solo lectura a la ruta remota respondió HTTP 404. |
| Core ANC | El Core auditado está en `9637c60` y contiene el manifiesto de Natalia. | `ANC.digital-platform`, rama `main`. |
| Blueprint de Natalia | `services-v1` para `retiro-acrocordones`, en staging y modo `dry_run`. | Manifiesto y dry-run del Core. |
| Neon | No existe un proyecto propio ni compartido encontrado para Natalia o `retiro-acrocordones`. | Búsquedas de solo lectura en Neon; no se consultó ninguna base de otro cliente. |
| Neon de Natalia | Proyecto aislado creado y rama `staging` verificada vacía. | Proyecto `empty-feather-09632084`; rama `staging` `br-polished-leaf-ay0iwq56`; la consulta de tablas devolvió una lista vacía. |
| Resend | La credencial conectada es de envío restringido y no permite leer dominios. | `list-domains` respondió `401 restricted_api_key`; no se envió correo ni se modificó Resend. |

## Diagnóstico

El código publicado en GitHub y servido como frontend del Admin ya conoce `platformFactory.blueprints.list` y `platformFactory.provisioning.list`. Sin embargo, Vercel no ejecuta ese servidor: su configuración reenvía todas las solicitudes `/api/*` al backend remoto de Manus. Ese backend devuelve 404 para la ruta de Platform Factory, por lo que el selector de presets no puede cargar aunque la rama `main` del frontend esté al día.

El frontend de Natalia (`natystudio`) ya fue confirmado por el usuario como proyecto Vercel existente y está vinculado al repositorio correspondiente. Sin embargo, la integración disponible en esta tarea no puede leer ese ID y solo ve el proyecto del Admin de ANC. Antes de modificar configuraciones, debe resolverse el alcance de acceso de Vercel o realizar los cambios guiados desde el panel del usuario. No se debe crear un proyecto duplicado.

Neon no tiene un proyecto o branch propio ni compartido identificado para Natalia. La cuenta de Resend conectada no tiene privilegios de lectura de dominios, por lo que no permite confirmar un remitente verificado; el mailing debe permanecer en `manual_required`. Solo una credencial con permisos administrativos de la cuenta correspondiente permitiría esa verificación, sin necesidad de exponer la clave en el chat.

Posteriormente se creó un proyecto Neon exclusivo para Natalia y una rama `staging` derivada de su rama inicial. Se verificó que la base `neondb` de staging no contiene tablas, por lo que no tiene datos heredados. Las credenciales de conexión se mantienen fuera de la documentación y no se han configurado en ningún frontend ni proveedor externo.

## Preview preparado, sin ejecutar

Cuando el backend efectivo del Admin exponga las rutas de Platform Factory y se cuente con acceso administrativo, el preview seguro debe usar:

| Campo | Valor propuesto |
|---|---|
| Cliente / proyecto | Natalia Rodríguez Studio — Retiro Acrocordones |
| Blueprint | `services-v1` |
| Entorno | `staging` |
| Slug | `retiro-acrocordones` |
| Modo | `dry_run` / preview solamente |
| Recursos externos | Ninguno |

Los bloqueos se mantienen intactos: dominio final, Neon dedicado, Resend, WhatsApp Cloud API, Mercado Pago, secretos server-only, deploy real y producción. No se debe tocar la lógica protegida de Mercado Pago ni la comisión ANC de 1,5 %.
