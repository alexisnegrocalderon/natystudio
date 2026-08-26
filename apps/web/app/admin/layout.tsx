import type { ReactNode } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = {
  title: "Panel",
  ...noIndexMetadata,
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-theme">
      <AdminGuard>{children}</AdminGuard>
    </div>
  );
}
