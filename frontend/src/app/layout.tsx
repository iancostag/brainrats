import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainRats — Estudos de Programação",
  description:
    "Desafios em grupo estilo GymRats para LeetCode, projetos, livros técnicos, ESW e Dados.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
