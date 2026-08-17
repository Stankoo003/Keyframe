import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

/*
 * Fontovi iz dizajna. Instrument Sans nosi naslove i telo teksta, IBM Plex Mono
 * sve mono mikro-labele, vremena i oznake kontrola.
 *
 * `next/font` ih hostuje lokalno u build-u, pa nema poziva ka Google fonts u
 * runtime-u — dizajn ih ucitava preko <link>, mi ne moramo.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Keyframe",
  description: "Keyframe app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr"
      className={`${instrumentSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
