# Preview de aprovisionamiento — Natalia Rodríguez Studio

## Objetivo de staging

Conectar el frontend existente `alexisnegrocalderon/natystudio` con un backend aislado de ANC Platform para el proyecto **Retiro Acrocordones**, sin usar datos de otros clientes y sin activar producción, pagos, WhatsApp ni mailing.

## Recursos propuestos

| Recurso | Acción propuesta | Identidad | Estado inicial |
|---|---|---|---|
| GitHub | Reutilizar, no crear repositorio nuevo. | `alexisnegrocalderon/natystudio`, rama `main` | Ya existe. |
| Vercel | Crear o enlazar el proyecto que el usuario denomina `natystudio` dentro del equipo conectado, solamente si no aparece luego de la confirmación final. | `natystudio` | Sin proyecto visible aún en el equipo auditado. |
| Neon | Crear un proyecto exclusivo, con rama `staging`. | `retiro-acrocordones` | No existe un proyecto propio o compartido identificado. |
| Backend ANC Core | Desplegar una instancia o entorno aislado del Core que use exclusivamente la base Neon anterior. | `retiro-acrocordones-core-staging` | Bloqueado hasta identificar el host del backend que actualmente atiende el Admin. |
| Frontend Natalia | Mantener el diseño y repositorio existentes; añadir la configuración pública mínima para consumir el backend de staging cuando éste tenga URL HTTPS. | `natystudio` | Landing visual existente, sin conexión al Core. |

## Blueprint de staging

| Campo | Valor |
|---|---|
| Cliente | Natalia Rodríguez Studio |
| Proyecto | Retiro Acrocordones |
| Preset | `services-v1` adaptado a estética |
| Slug | `retiro-acrocordones` |
| Locale / moneda / zona horaria | `es-CL` / `CLP` / `America/Santiago` |
| Entorno | `staging` |
| Modo inicial | `dry_run` y validaciones de salud |
| Módulos del Core | `catalogue`, `pricing`, `crm`, `reservations`, `reporting`, `notifications` |

## Secuencia de creación propuesta

1. Crear en Neon el proyecto aislado `retiro-acrocordones` y su rama `staging`; no se copiarán datos desde ninguna otra base.
2. Ejecutar migraciones del Core exclusivamente contra esa rama de staging y validar las tablas esperadas, sin sembrar información de otros clientes.
3. Identificar o desplegar el backend del Core usando las variables server-only de ese staging. El backend debe exponer los endpoints del Core para los módulos habilitados.
4. Crear o enlazar en Vercel el proyecto `natystudio` con el repositorio existente y la rama `main`, con despliegue de preview inicialmente. No se asociará un dominio final.
5. Conectar el frontend existente a la URL HTTPS del Core de staging mediante una variable pública limitada a la URL de API, sin exponer claves ni credenciales.
6. Probar el flujo de lectura, reserva en borrador y notificación simulada. No se enviarán correos, mensajes de WhatsApp ni cobros.

## Variables y bloqueos

| Elemento | Estado en staging | Regla |
|---|---|---|
| `DATABASE_URL` y `DIRECT_DATABASE_URL` | Se crearán para la rama Neon aislada. | Solo server-side. |
| URL pública del Core | Pendiente de host HTTPS del backend. | Puede ser pública; no contiene secretos. |
| Dominio final de Natalia | Pendiente. | No se compra ni registra. |
| Resend | `manual_required`. | La credencial conectada no puede leer dominios; no se habilita mailing. |
| Mercado Pago | `manual_required`. | No se configuran credenciales ni se toca comisión ANC. |
| WhatsApp Cloud API | `manual_required`. | No se registran token, WABA, plantilla ni webhook. |
| Producción | Bloqueada. | Solo tras validaciones, dominio y aprobación explícita. |

## Prerrequisito del Admin de ANC

Antes de usar `/admin/fabrica` para el preview visual, el backend de Manus que recibe las solicitudes desde `www.ancdigital.cl` debe actualizarse o reemplazarse por una instancia que exponga `platformFactory.blueprints.list` y `platformFactory.provisioning.list`. El frontend Vercel ya contiene esas rutas, pero su rewrite apunta a un backend remoto que responde 404. La creación de recursos de Natalia no corrige por sí sola esa discrepancia.

## Acciones excluidas de este preview

No se crearán recursos de producción, dominios, correos, campañas, contactos, checkout, preferencias de pago, webhooks de proveedores, tokens de WhatsApp ni credenciales en el frontend. No se modificarán Mercado Pago, ventas, liquidaciones ni la comisión ANC del 1,5 %.
