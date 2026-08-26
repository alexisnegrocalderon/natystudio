import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { ScrollReveal } from "@/components/ScrollReveal";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { localBusinessJsonLd } from "@/lib/seo";
import { INDEXING_ENABLED, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { TrpcProvider } from "@/lib/trpc";
import "./globals.css";

// next/font descarga y auto-hospeda las tipografías en el build: sin petición a
// Google en tiempo de ejecución y sin salto de texto al cargar.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · Enfermera estética en Valparaíso`,
    // Cada página aporta su título y aquí se le añade la marca.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Naty" }],
  creator: "naty.studio",
  formatDetection: { telephone: false },
  // Mientras no exista el dominio definitivo el sitio entero se mantiene fuera
  // del índice. Ver la explicación en lib/site.ts.
  robots: INDEXING_ENABLED ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fff6f8",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CL" className={`${dmSans.variable} ${playfair.variable}`} data-scroll-behavior="smooth">
      <body>
        <JsonLd data={localBusinessJsonLd()} />
        <TrpcProvider>
          <div className="site-shell">
            <SiteHeader />
            <main id="contenido">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
          <ScrollReveal />
        </TrpcProvider>
      </body>
    </html>
  );
}
