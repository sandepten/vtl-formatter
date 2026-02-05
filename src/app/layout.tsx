import { Analytics } from "@vercel/analytics/react";
import "@/styles/globals.css";

import { type Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "VTL Formatter - Apache Velocity Template Language Formatter",
  description:
    "A beautiful formatter for Apache Velocity Template Language (VTL) code with clean formatting and automatic indentation. Format your Velocity code with ease.",
  metadataBase: new URL("https://vtl-formatter.vercel.app"),
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "Apache Velocity Template Language (VTL) Formatter",
    description:
      "Format your Apache Velocity Template Language code with ease. Clean formatting for VTL templates.",
    url: "https://vtl-formatter.vercel.app",
    siteName: "VTL Formatter",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    title: "Apache Velocity Template Language Formatter",
    description:
      "A beautiful formatter for Apache Velocity Template Language (VTL) code",
    card: "summary_large_image",
  },
  alternates: {
    canonical: "https://vtl-formatter.vercel.app",
  },
  keywords: [
    "VTL",
    "Velocity",
    "Apache Velocity",
    "formatter",
    "code formatter",
    "template language",
    "velocity template language",
    "apache velocity formatter",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
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
