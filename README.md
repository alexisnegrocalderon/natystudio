# naty.studio

Sitio web y sistema de agenda para naty.studio — enfermera estética en Valparaíso.

```
apps/web        Next.js  →  Vercel   Sitio público, embudo de reserva, panel y backend (todo en uno)
packages/api                          tRPC, esquema de base de datos, correos y recordatorios
packages/shared                       Tipos, validaciones y formatos comunes
```

Un solo despliegue: el backend corre como rutas de API dentro del mismo proyecto de Next.js, no
como un servicio aparte. `packages/api` es la librería de dominio que `apps/web` consume — ya no
se despliega por su cuenta, sólo se usa localmente para mantenimiento de la base
(`pnpm db:migrate`, `pnpm db:seed`).

---

## Puesta en marcha

Necesitas Node 22 o superior y pnpm 10.

```bash
pnpm install
```

### 1. Crear la base de datos en Neon (gratis)

1. Entra a **[neon.tech](https://neon.tech)** y crea una cuenta (con GitHub es lo más rápido).
2. **Create project** → elige la región **AWS São Paulo (sa-east-1)**, la de menor latencia hacia Chile.
3. En *Connection Details*, copia la cadena **pooled** — la que trae `-pooler` en el host.
   La directa se satura cuando el servidor abre varias conexiones a la vez.
4. En **Branches**, crea una rama llamada `dev`. Te da una copia aislada de la base para trabajar
   sin tocar los datos reales; cada rama tiene su propia cadena de conexión.

> El plan gratuito suspende la base tras unos minutos sin uso. La primera consulta después de una
> pausa tarda un poco más de lo normal: es el comportamiento esperado, no un error de configuración.

### 2. Configurar el sitio

```bash
cp apps/web/.env.example apps/web/.env.local
```

Completa como mínimo:

```bash
DATABASE_URL=postgresql://usuario:clave@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
ADMIN_SESSION_SECRET=   # genera con: openssl rand -base64 32
CRON_SECRET=            # genera igual; protege /api/cron
```

`sslmode=require` no es opcional: Neon rechaza las conexiones sin TLS.

### 3. Crear las tablas y la cuenta de administración

```bash
cp packages/api/.env.example packages/api/.env
```

Completa `DATABASE_URL` (la misma de arriba) y `ADMIN_EMAIL`, luego:

```bash
pnpm db:migrate   # crea las tablas y el constraint anti-solapamiento
pnpm db:seed      # cuenta de administración, horario base y el primer servicio
```

El seed imprime la contraseña generada **una sola vez**. Guárdala antes de cerrar la terminal.

### 4. Levantar el sitio

```bash
pnpm dev
```

- Sitio: <http://localhost:3000>
- Panel: <http://localhost:3000/admin>

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta el sitio (incluye el backend) |
| `pnpm build` | Compila para producción |
| `pnpm test` | Corre los tests |
| `pnpm check` | Verifica los tipos en todos los paquetes |
| `pnpm db:migrate` | Aplica las migraciones |
| `pnpm db:seed` | Siembra los datos iniciales |
| `pnpm db:studio` | Abre el explorador visual de la base |

---

## Cómo funciona la agenda

**Doble reserva imposible por diseño.** PostgreSQL rechaza cualquier cita cuyo rango se cruce con
otra que siga ocupando la hora, mediante un constraint de exclusión (`appointments_no_overlap`).
No depende de que el código bloquee correctamente: si dos personas reservan el mismo horario a la
vez, la base rechaza la segunda. El rango protegido llega hasta `blocked_until`, es decir incluye
el tiempo de limpieza posterior.

**Zona horaria.** Chile cambia la hora dos veces al año. Todos los instantes se guardan en UTC
(`timestamptz`) y se convierten a `America/Santiago` sólo al mostrarlos. El motor de disponibilidad
descarta además las horas locales que no existen durante el adelanto de septiembre.

**Estados de una cita.**

```
pending_approval ──(Naty confirma)──> confirmed ──> completed / no_show
       │                                  │
       └──────────(cancelada)─────────────┴──> cancelled

pending_payment ──(pago aprobado)────> confirmed  (con Mercado Pago activado)
       │
       └──(vence sin pagar, o pago rechazado sin reintento)──> cancelled
```

Con la aprobación automática activada en Ajustes, la reserva nace directamente en `confirmed`. Con
`PAYMENTS_ENABLED=true` y un servicio con precio, nace en `pending_payment`: la hora queda retenida
(protegida por el mismo constraint de exclusión) hasta que el pago se aprueba o pasan 15 minutos sin
pagar.

**Correos y recordatorios.** Se encolan en `email_jobs` y los procesa `GET /api/cron` — no hay un
proceso interno corriendo el cron (no hay proceso permanente en absoluto: es todo funciones que se
despiertan por petición). Un servicio externo tiene que llamar a esa ruta cada 5 minutos (ver
"Recordatorios programados" más abajo). La idempotencia vive en la fila de la base, así que dos
disparos superpuestos no duplican ni pierden avisos. La misma pasada también reconcilia pagos que
quedaron "pending" sin novedad, por si algún aviso de Mercado Pago no llegó.

---

## Despliegue

Un solo proyecto en **Vercel**, apuntando a la raíz del repositorio (Next.js detecta `apps/web`
automáticamente si se configura como Root Directory, o usa el `pnpm --filter @naty/web build` de
la raíz).

- **Root Directory**: `apps/web`
- **Variables**: las de `apps/web/.env.example` — `DATABASE_URL`, `ADMIN_SESSION_SECRET`,
  `CRON_SECRET`, `SITE_URL`/`NEXT_PUBLIC_SITE_URL`, y opcionalmente `RESEND_API_KEY`,
  `ADMIN_NOTIFY_EMAIL`, y `PAYMENTS_ENABLED`/`MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/`MP_WEBHOOK_SECRET`
  cuando llegue el momento de cobrar en línea.

Corre `pnpm db:migrate` y `pnpm db:seed` una vez contra la base de producción (desde tu máquina, o
pegando el SQL equivalente en el SQL Editor de Neon si no tienes terminal a mano).

### Recordatorios programados (`/api/cron`)

Sin un proceso permanente, algo externo tiene que disparar el mantenimiento cada 5 minutos:

1. Crea una cuenta gratuita en **[cron-job.org](https://cron-job.org)** (o similar).
2. Programa una llamada GET cada 5 minutos a:
   ```
   https://tudominio.cl/api/cron?key=<CRON_SECRET>
   ```
3. Confirma en los logs de Vercel que la ruta responde `{"ok":true,"sent":...,"released":...}`.

Sin la clave correcta, la ruta devuelve `401` — así nadie más puede forzar el reenvío de
recordatorios.

### Cobrar en línea con Mercado Pago

Los pagos están implementados (Payment Brick embebido en `/reservar`, webhook con verificación de
firma en `/api/webhooks/mercadopago`, reconciliador en el cron) pero **apagados por defecto**
(`PAYMENTS_ENABLED=false`): mientras tanto toda reserva sigue el flujo de siempre (Naty confirma a
mano). Para encenderlos:

1. Crea la aplicación en el panel de desarrolladores de Mercado Pago y copia `MP_ACCESS_TOKEN` y
   `MP_PUBLIC_KEY` (empieza con las credenciales de **prueba** para probar el flujo sin cobrar de
   verdad).
2. Configura el webhook de esa aplicación para el evento "Pagos" apuntando a
   `https://tudominio.cl/api/webhooks/mercadopago`, y copia la clave secreta a `MP_WEBHOOK_SECRET`.
3. Carga el **abono** de cada servicio desde `/admin/servicios` (déjalo en 0 si el servicio sólo
   debe ofrecer pagar el total).
4. Pon `PAYMENTS_ENABLED=true` y prueba una reserva completa antes de pasar a credenciales de
   producción.

---

## Antes de lanzar

- [ ] **Comprar el dominio** y apuntarlo a Vercel.
- [ ] **Verificar el dominio en Resend.** Sin verificar, Resend sólo envía desde
      `onboarding@resend.dev` y únicamente hacia la casilla dueña de la cuenta: sirve para
      desarrollar, **no** para escribirle a clientas.
- [ ] **Cargar precios y duraciones reales** de cada servicio desde el panel. Con el precio en cero
      el sitio muestra "Consulta el valor" en vez de un monto.
- [ ] **Activar la verificación en dos pasos** en Ajustes y guardar los códigos de respaldo.
- [ ] **Configurar el pinger de `/api/cron`** (ver arriba) — sin esto no salen los recordatorios.
- [ ] **Si vas a cobrar en línea**, seguir los pasos de "Cobrar en línea con Mercado Pago" arriba
      (puede quedar para después: el sitio funciona igual con `PAYMENTS_ENABLED=false`).
- [ ] **Recién entonces**, poner `NEXT_PUBLIC_INDEXING_ENABLED=true`.

> El último punto importa más de lo que parece. Si Google alcanza a indexar el sitio bajo una URL
> `*.vercel.app`, esas direcciones quedan después compitiendo con el dominio real y sacarlas del
> índice cuesta semanas. Es el último paso del lanzamiento, no el primero.

---

## Pendiente

**Idiomas.** El sitio está sólo en español. Con Next.js lo correcto son rutas `/es`, `/pt` y `/en`
con `hreflang`, como trabajo aparte.
