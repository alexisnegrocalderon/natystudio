# naty.studio

Sitio web y sistema de agenda para naty.studio — enfermera estética en Valparaíso.

```
apps/web        Next.js  →  Vercel    Sitio público, embudo de reserva y panel
apps/api        Express  →  Railway   tRPC, base de datos, correos y recordatorios
packages/shared                       Tipos, validaciones y formatos comunes
```

Frontend y backend se despliegan por separado: el sitio es estático y vive en un CDN, mientras el
API es un proceso permanente que puede correr tareas programadas y, más adelante, recibir los
avisos de pago de Mercado Pago.

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

### 2. Configurar el API

```bash
cp apps/api/.env.example apps/api/.env
```

Completa como mínimo:

```bash
DATABASE_URL=postgresql://usuario:clave@ep-xxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
ADMIN_SESSION_SECRET=   # genera con: openssl rand -base64 32
ADMIN_EMAIL=            # el correo con el que entrará Naty al panel
```

`sslmode=require` no es opcional: Neon rechaza las conexiones sin TLS.

Crea las tablas y los datos iniciales:

```bash
pnpm db:migrate   # crea las tablas y el constraint anti-solapamiento
pnpm db:seed      # cuenta de administración, horario base y el primer servicio
```

El seed imprime la contraseña generada **una sola vez**. Guárdala antes de cerrar la terminal.

### 3. Configurar el sitio

```bash
cp apps/web/.env.example apps/web/.env.local
```

Con los valores por defecto ya apunta al API local.

### 4. Levantar todo

```bash
pnpm dev
```

- Sitio: <http://localhost:3000>
- Panel: <http://localhost:3000/admin>
- API: <http://localhost:4000>

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta sitio y API a la vez |
| `pnpm build` | Compila ambos |
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
```

Con la aprobación automática activada en Ajustes, la reserva nace directamente en `confirmed`.

**Correos.** Se encolan en `email_jobs` y los envía un cron cada cinco minutos. La idempotencia
vive en la fila de la base, así que reiniciar el servidor no duplica ni pierde recordatorios.

---

## Despliegue

### Sitio en Vercel

Importa el repositorio y configura:

- **Root Directory**: `apps/web`
- **Variables**:
  ```
  NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app
  NEXT_PUBLIC_SITE_URL=https://tudominio.cl
  NEXT_PUBLIC_INDEXING_ENABLED=false
  REVALIDATE_SECRET=<mismo valor que en el API>
  ```

### API en Railway

- **Root Directory**: `apps/api`
- **Build**: `pnpm install && pnpm build`
- **Start**: `pnpm start`
- **Variables**: las de `apps/api/.env.example`, con `WEB_ORIGIN` apuntando al dominio de Vercel
  (nunca un comodín: las peticiones del panel viajan con cookie de sesión).

Ejecuta `pnpm db:migrate` una vez contra la base de producción.

---

## Antes de lanzar

- [ ] **Comprar el dominio** y apuntarlo a Vercel.
- [ ] **Verificar el dominio en Resend.** Sin verificar, Resend sólo envía desde
      `onboarding@resend.dev` y únicamente hacia la casilla dueña de la cuenta: sirve para
      desarrollar, **no** para escribirle a clientas.
- [ ] **Cargar precios y duraciones reales** de cada servicio desde el panel. Con el precio en cero
      el sitio muestra "Consulta el valor" en vez de un monto.
- [ ] **Activar la verificación en dos pasos** en Ajustes y guardar los códigos de respaldo.
- [ ] **Recién entonces**, poner `NEXT_PUBLIC_INDEXING_ENABLED=true`.

> El último punto importa más de lo que parece. Si Google alcanza a indexar el sitio bajo una URL
> `*.vercel.app`, esas direcciones quedan después compitiendo con el dominio real y sacarlas del
> índice cuesta semanas. Es el último paso del lanzamiento, no el primero.

---

## Pendiente

**Mercado Pago.** El esquema de `payments` ya existe y la integración queda tras
`PAYMENTS_ENABLED=false`. Mientras esté apagado, la reserva queda pendiente y Naty la confirma a
mano. Al llegar las credenciales hay que implementar Checkout Bricks y su webhook, y encender el
flag: el esquema no cambia.

**Idiomas.** El sitio está sólo en español. Con Next.js lo correcto son rutas `/es`, `/pt` y `/en`
con `hreflang`, como trabajo aparte.
