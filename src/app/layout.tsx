import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Jersey_10 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoterBootstrap } from "@/components/VoterBootstrap";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";

// Body copy, tables, and every number on the site (votes, ranks, stat
// lines) stay on a clean grotesk — a pixel face reads as decoration at
// paragraph/data sizes, not as digits.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Fallback for --font-display wherever Jersey 10 (below) needs a second
// weight or a browser lacks it — condensed and clean, still reads fine on
// its own.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Headings, nav, buttons, badges — the site's "display" face. Jersey 10 is
// modeled on sports-jersey numbering/lettering: blocky and pixel-grid-
// aligned like the rest of the redesign, but built to actually read as
// words rather than simulate low-res pixels (unlike Pixelify Sans, which
// this replaced after it proved hard to read) — and it's a natural fit for
// a *sports* site specifically. Never applied to numbers or small text
// (see the `.tabular-nums` / `.text-xs` overrides in globals.css).
const jersey10 = Jersey_10({
  variable: "--font-jersey",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Stat Padder — Vote on NHL Player Attributes",
  description:
    "Vote on individual skill attributes for NHL skaters and goalies. No signup required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} ${jersey10.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthSessionProvider>
            <VoterBootstrap />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
