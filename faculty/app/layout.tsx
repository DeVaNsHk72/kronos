import "./globals.css";
import type { Metadata } from "next";
import { Chrome } from "@/components/Chrome";
import { usingDatabricks } from "@/lib/db";

export const metadata: Metadata = {
  title: "Kronos Faculty",
  description: "Set papers from the archive, and see what it has been asking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Chrome backend={usingDatabricks ? "databricks" : "local"}>{children}</Chrome>
      </body>
    </html>
  );
}
