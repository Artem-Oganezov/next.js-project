import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import Providers from "@/components/Providers";
import { gameMeta } from "@/game/meta";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
});

const siteUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${gameMeta.displayName} — online game with leaderboards`,
  description: gameMeta.description,
  openGraph: {
    title: `${gameMeta.displayName} — online game with leaderboards`,
    description: gameMeta.description,
    type: "website",
    siteName: gameMeta.displayName,
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: `${gameMeta.displayName} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${gameMeta.displayName} — online game with leaderboards`,
    description: gameMeta.description,
    images: ["/og.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff3f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} ${nunito.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
