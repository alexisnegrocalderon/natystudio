"use client";

import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

const ADMIN_LINKS = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientas", label: "Clientas", icon: Users },
  { href: "/admin/servicios", label: "Servicios", icon: Sparkles },
  { href: "/admin/horarios", label: "Horarios", icon: Clock },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
];

export function AdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

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

  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Navegación del panel">
        {ADMIN_LINKS.map(link => {
          const Icon = link.icon;
          const current = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
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

      <div>{children}</div>
    </div>
  );
}
