import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Providers } from "@/components/providers";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrainRats — Estudos de Programação",
  description:
    "Desafios em grupo para LeetCode, projetos, livros técnicos, Engenharia de Software e Dados.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
