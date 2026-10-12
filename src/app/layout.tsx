import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (SIL Open Font License, see ./fonts) so builds and demos work offline.
const display = localFont({
  variable: "--font-display-face",
  display: "swap",
  src: [
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
});

const body = localFont({
  variable: "--font-body",
  display: "swap",
  src: [{ path: "./fonts/manrope-latin-wght-normal.woff2", weight: "200 800", style: "normal" }],
});

export const metadata: Metadata = {
  title: {
    default: "Monrovia Cinema Plus — Movies & Tickets at Monrovia Super Mall",
    template: "%s · Monrovia Cinema Plus",
  },
  description:
    "Book cinema tickets at Monrovia Cinema Plus, Monrovia Super Mall, Monrovia, Liberia. Browse films, choose your seats and get a digital ticket.",
  applicationName: "Monrovia Cinema Plus",
  openGraph: { siteName: "Monrovia Cinema Plus", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
