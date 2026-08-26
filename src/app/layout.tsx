import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VoterBootstrap } from "@/components/VoterBootstrap";
import { VotesRemainingProvider } from "@/components/VotesRemainingProvider";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <VotesRemainingProvider>
            <VoterBootstrap />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </VotesRemainingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
