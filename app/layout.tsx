import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Section Field",
  description: "A reversible generator and spatial analysis workspace for proto-architectural sections.",
  icons: {
    icon: "/fausoa-logo.png",
    shortcut: "/fausoa-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
