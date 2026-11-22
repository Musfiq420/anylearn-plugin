import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no request to Google at build time). Each file is split by
// unicode-range, so browsers only download the scripts a page actually uses.
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-bengali";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource-variable/noto-sans-arabic";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "AnyLearn", template: "%s · AnyLearn" },
  description: "Turn anything into an interactive course, using your own ChatGPT or Claude.",
};

export const viewport: Viewport = {
  themeColor: "#FDF8EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
