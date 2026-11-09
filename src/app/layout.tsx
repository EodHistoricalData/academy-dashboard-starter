import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Market tool starter",
  description:
    "A Next.js starter for building your own market dashboard on the EODHD APIs, " +
    "with the API key kept server-side.",
};

/** Where the data's terms are summarised; the code's licence does not cover the data. */
const NOTICE_URL = "https://github.com/EodHistoricalData/academy-dashboard-starter/blob/main/NOTICE";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* One footer, here, so a page added later cannot forget it. */}
        <footer className="border-t border-zinc-200 bg-zinc-50 px-6 py-6 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <p className="mx-auto max-w-6xl">
            Powered by EODHD APIs · Not investment advice ·{" "}
            <a href={NOTICE_URL} className="underline underline-offset-2">
              Data licence
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
