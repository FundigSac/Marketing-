import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FUNDIGSAC Marketing OS",
  description: "Centro de planificación, producción y resultados de marketing de FUNDIGSAC",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#194391" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
