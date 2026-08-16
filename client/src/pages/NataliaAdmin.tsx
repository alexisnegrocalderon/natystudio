import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AdminUser = { email: string; role: "owner" | "manager" };
type DashboardData = {
  overview: {
    activeServices: number;
    clientCount: number;
    pendingBookings: number;
    blockedNotifications: number;
    integrations: { mailing: string; payments: string; whatsapp: string };
  };
  services: Array<{ slug: string; name: string; description: string; priceNote: string; durationNote: string }>;
};

const menu = [
  { label: "Resumen", icon: LayoutDashboard, active: true },
  { label: "Agenda", icon: CalendarDays },
  { label: "Servicios", icon: Sparkles },
  { label: "Reservas", icon: UsersRound },
  { label: "Cursos", icon: BookOpen },
  { label: "Pagos", icon: CircleDollarSign },
  { label: "Contenido", icon: FileText },
];

async function request<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, { credentials: "include", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "No fue posible completar la solicitud.");
  return data as T;
}

function LoginPanel({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [email, setEmail] = useState("studio.nataliarodriguez@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await request<{ user: AdminUser }>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#1e1719] px-5 py-8 text-[#20181a] sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] bg-[#fbf6f2] shadow-[0_24px_70px_rgba(0,0,0,.35)]">
        <div className="bg-[#281e21] px-8 py-9 text-[#f9e5e6]">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f6a1ae]">Natalia Rodríguez Studio</p>
          <h1 className="mt-3 font-serif text-4xl italic leading-none">Panel privado</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#e9d5d6]">Gestiona tu agenda, servicios, reservas y próximos módulos desde un solo lugar.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 px-8 py-8">
          <label className="block text-sm font-semibold">Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-[#d9c9c5] bg-white px-4 py-3 outline-none ring-[#ee7488] focus:ring-2" required />
          </label>
          <label className="block text-sm font-semibold">Contraseña
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[#d9c9c5] bg-white px-4 py-3 outline-none ring-[#ee7488] focus:ring-2" required />
          </label>
          {error ? <p className="rounded-xl bg-[#fde9eb] px-3 py-2 text-sm text-[#a13647]">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-xl bg-[#ed7186] px-4 py-3 font-bold text-[#2b171b] transition hover:bg-[#e85e78] disabled:cursor-wait disabled:opacity-70">
            {loading ? "Ingresando…" : "Entrar a mi administración"}
          </button>
          <p className="text-center text-xs leading-5 text-[#76636a]">Acceso privado de staging. Tus credenciales no se comparten con la operación central de ANC.</p>
        </form>
      </section>
    </main>
  );
}

export default function NataliaAdmin() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  async function loadDashboard() {
    const data = await request<DashboardData>("/api/admin/dashboard");
    setDashboard(data);
  }

  useEffect(() => {
    request<{ user: AdminUser }>("/api/admin/me")
      .then(async (data) => {
        setUser(data.user);
        await loadDashboard();
      })
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function signOut() {
    await request("/api/admin/logout", { method: "POST" });
    setUser(null);
    setDashboard(null);
  }

  if (checking) return <main className="grid min-h-screen place-items-center bg-[#1e1719] text-[#f9e5e6]">Cargando tu espacio privado…</main>;
  if (!user) return <LoginPanel onLogin={async (loggedUser) => { setUser(loggedUser); await loadDashboard(); }} />;

  const overview = dashboard?.overview;
  const metrics: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Servicios activos", value: overview?.activeServices ?? 0, icon: Sparkles },
    { label: "Solicitudes pendientes", value: overview?.pendingBookings ?? 0, icon: CalendarDays },
    { label: "Pacientes registrados", value: overview?.clientCount ?? 0, icon: UsersRound },
    { label: "Notificaciones bloqueadas", value: overview?.blockedNotifications ?? 0, icon: FileText },
  ];
  return (
    <main className="min-h-screen bg-[#f7f1ec] text-[#241b1d]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#dacbc6] bg-[#f7f1ec]/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#2b2022] font-serif text-lg italic text-[#f6b7c0]">Nr</span><div><p className="font-serif text-lg leading-none">Natalia Rodríguez</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#9a5964]">Administración privada</p></div></div>
        <button onClick={signOut} className="inline-flex items-center gap-2 rounded-full border border-[#cbb8b3] px-3 py-2 text-xs font-bold hover:bg-white"><LogOut size={14} /> Salir</button>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-3xl bg-[#2a2022] p-4 text-[#f8e9e8] lg:sticky lg:top-24 lg:h-fit">
          <p className="px-3 pb-4 text-xs text-[#d7b2b5]">Hola, {user.email.split("@")[0]}</p>
          <nav className="space-y-1">{menu.map(({ label, icon: Icon, active }) => <button key={label} onClick={() => setNotice(`${label} estará disponible dentro de este portal durante el siguiente módulo.`)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? "bg-[#ed7186] font-bold text-[#28181b]" : "hover:bg-white/10"}`}><Icon size={17} />{label}</button>)}</nav>
          <div className="mt-5 rounded-2xl border border-[#735d61] px-3 py-4 text-xs leading-5 text-[#d9c2c5]"><Settings2 size={15} className="mb-2" />Entorno de prueba conectado a Neon staging. Pagos, mailing y WhatsApp permanecen bloqueados.</div>
        </aside>
        <section className="space-y-6">
          <div className="rounded-3xl bg-[#e97486] p-7 text-[#2b171b] sm:flex sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em]">Tu negocio, en un solo lugar</p><h1 className="mt-3 max-w-2xl font-serif text-4xl italic leading-[.95] sm:text-5xl">Organiza tu atención con claridad.</h1></div><div className="mt-5 rounded-2xl bg-[#f9d95d] px-4 py-3 text-sm font-bold sm:mt-0"><Clock3 size={16} className="mr-2 inline" />Staging activo</div></div>
          {notice ? <button onClick={() => setNotice("")} className="w-full rounded-2xl bg-[#fff1d2] px-4 py-3 text-left text-sm text-[#59411b]">{notice} ×</button> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-2xl border border-[#decfca] bg-white p-5"><Icon size={19} className="text-[#d85e73]" /><p className="mt-6 text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-[#756269]">{label}</p></article>)}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
            <section className="rounded-3xl border border-[#decfca] bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a7616e]">Catálogo público</p><h2 className="mt-2 font-serif text-3xl italic">Servicios activos</h2></div><button onClick={() => setNotice("La edición de servicios se habilitará en el siguiente módulo del portal.")} className="rounded-full bg-[#2c2022] px-4 py-2 text-xs font-bold text-white">Editar catálogo</button></div><div className="mt-6 space-y-3">{dashboard?.services.map((service) => <article key={service.slug} className="rounded-2xl bg-[#f8f1ed] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{service.name}</h3><p className="mt-1 text-sm leading-5 text-[#6f5e65]">{service.description}</p></div><span className="rounded-full bg-[#f9d95d] px-2 py-1 text-[10px] font-bold uppercase">Activo</span></div><p className="mt-3 text-xs font-bold text-[#a45563]">{service.priceNote} · {service.durationNote}</p></article>)}</div></section>
            <section className="rounded-3xl bg-[#2a2022] p-6 text-[#f8e9e8]"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#ed9aa7]">Próximo paso</p><h2 className="mt-2 font-serif text-3xl italic">Tu agenda online</h2><p className="mt-4 text-sm leading-6 text-[#d7c1c4]">Aquí podrás definir horarios, bloqueos, cupos y la política de pago antes de publicar el embudo de reservas.</p><button onClick={() => setNotice("La configuración de agenda estará disponible en el siguiente módulo.")} className="mt-6 rounded-full bg-[#ed7186] px-4 py-2 text-xs font-bold text-[#28181b]">Configurar agenda</button><div className="mt-7 border-t border-white/15 pt-5 text-xs text-[#c9adb1]">Pagos de staging: bloqueados<br />Correo y WhatsApp: bloqueados</div></section>
          </div>
        </section>
      </div>
    </main>
  );
}
