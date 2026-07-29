import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./saas.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://olx-radar.invalid";
  const title = "Radar Market — monitor OLX i Vinted";
  const description =
    "Osobisty radar ofert OLX i Vinted z prywatnymi filtrami oraz powiadomieniami Discord.";

  return {
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      description,
      images: [{ alt: "Radar Market — OLX i Vinted", url: `${origin}/og-v2.png` }],
      title,
      type: "website",
      url: origin,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [`${origin}/og-v2.png`],
      title,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
