"use client";

import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  Clock,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminSheet } from "@/components/admin/AdminSheet";
import { trpc } from "@/lib/trpc";

const ADMIN_LINKS = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/ventas", label: "Ventas", icon: Wallet },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientas", label: "Clientas", icon: Users },
  { href: "/admin/leads", label: "Interesadas", icon: UserPlus },
  { href: "/admin/servicios", label: "Servicios", icon: Sparkles },
  { href: "/admin/horarios", label: "Horarios", icon: Clock },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
];

/** Accesos fijos de la barra inferior del teléfono; el resto va en "Más". */
const TAB_HREFS = ["/admin", "/admin/agenda", "/admin/ventas", "/admin/clientas"];
const TAB_LINKS = TAB_HREFS.map(href => ADMIN_LINKS.find(link => link.href === href)!);
const MORE_LINKS = ADMIN_LINKS.filter(link => !TAB_HREFS.includes(link.href));

export function AdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.push("/admin/login");
    },
  });

  useEffect(() => {
    if (isLoading || isLoginPage) return;
    if (!user) router.replace("/admin/login");
  }, [user, isLoading, isLoginPage, router]);

  // Cambiar de página cierra el cajón móvil: sin esto queda abierto sobre
  // la vista nueva.
  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  if (isLoginPage) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="section-wrap" style={{ padding: "5rem 0", color: "var(--muted)" }}>
        <p style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
          <Loader2 size={17} className="animate-spin" /> Verificando tu sesión…
        </p>
      </div>
    );
  }

  // La redirección la dispara el efecto; mientras tanto no se pinta nada del
  // panel para no mostrar su estructura a quien no ha iniciado sesión.
  if (!user) return null;

  const isCurrent = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <>
      <div className="admin-topbar">
        <Link href="/admin" className="wordmark" aria-label="Natalia Rodríguez Studio, ir al inicio del panel">
          <Image src="/logo-black.png" alt="Natalia Rodríguez Studio" width={1519} height={572} />
        </Link>
        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen(open => !open)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="admin-menu-movil"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        <nav className="admin-mobile-nav" id="admin-menu-movil" data-open={menuOpen} aria-label="Navegación del panel">
          {ADMIN_LINKS.map(link => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </nav>
      </div>

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav className="admin-nav" aria-label="Navegación del panel">
            {ADMIN_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                  <Icon size={16} aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}

            <button
              type="button"
              className="mini-button"
              style={{ marginTop: "1rem", justifySelf: "start" }}
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut size={13} style={{ display: "inline", marginRight: ".35rem" }} />
              Cerrar sesión
            </button>
          </nav>
        </aside>

        <div style={{ minWidth: 0 }}>{children}</div>
      </div>

      <nav className="admin-tabbar" aria-label="Secciones principales">
        {TAB_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
              <Icon size={21} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen || MORE_LINKS.some(link => isCurrent(link.href))}
          aria-haspopup="dialog"
        >
          <MoreHorizontal size={21} aria-hidden="true" />
          Más
        </button>
      </nav>

      <AdminSheet open={moreOpen} title="Más" onClose={() => setMoreOpen(false)}>
        <div className="admin-more">
          {MORE_LINKS.map(link => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                <Icon size={19} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={19} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </AdminSheet>
    </>
  );
}
