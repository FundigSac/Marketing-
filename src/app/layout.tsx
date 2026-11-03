import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FUNDIGSAC Marketing",
  description: "Dashboard creativo para planificar, crear y organizar los videos de marketing de FUNDIGSAC",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon-64.png", sizes: "64x64", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
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
