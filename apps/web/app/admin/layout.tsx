import type { ReactNode } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  title: "Panel",
  ...noIndexMetadata,
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
