import { Analytics } from "@vercel/analytics/react";
import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "VTL Formatter - Velocity Template Language Formatter",
  description:
    "A beautiful formatter for Velocity Template Language (VTL) code with clean formatting and automatic indentation.",
  metadataBase: new URL("https://vtl-formatter.vercel.app"),
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "VTL Formatter",
    description: "Format your Velocity Template Language code with ease",
    url: "https://vtl-formatter.vercel.app",
    siteName: "VTL Formatter",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    title: "VTL Formatter",
    description:
      "A beautiful formatter for Velocity Template Language (VTL) code",
    card: "summary_large_image",
  },
  alternates: {
    canonical: "https://vtl-formatter.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <meta
          name="google-site-verification"
          content="I6XhB62PxEyuECZisefa07gEQPu6UkCV2YbheJkyoS8"
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
