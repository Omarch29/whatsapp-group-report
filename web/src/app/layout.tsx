import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { copy } from "../../content/copy";
import { Gate } from "@/components/Gate";
import { SmoothScroll } from "@/components/SmoothScroll";
import { getTitle, loadGlobal } from "@/lib/data";
import { assertGateAuditAllowed } from "@/lib/gateEnv";
import { normalizeWord, sha256HexSync } from "@/lib/hash";
import "./globals.css";

// Variable Archivo with the width axis: 125% for numbers and headings, 100% for text.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--wide",
});

export async function generateMetadata(): Promise<Metadata> {
  const title = await getTitle();
  return { title, robots: { index: false, follow: false }, openGraph: { title } };
}

/**
 * The group word is read at build time and only its hash reaches the client.
 * Local: web/.env.local. Production: NEXT_PUBLIC_GATE_WORD in the Vercel project env.
 * Only read when global.json has `gate: true`; with `gate: false` the variable is not needed.
 */
function gateHash(): string {
  const word = process.env.NEXT_PUBLIC_GATE_WORD;
  if (!word) {
    throw new Error("NEXT_PUBLIC_GATE_WORD is not set (web/.env.local locally, Vercel env in production)");
  }
  return sha256HexSync(normalizeWord(word));
}

/**
 * AUDIT ONLY: NEXT_PUBLIC_GATE_DISABLED=1 at build renders the site without the gate,
 * so Lighthouse can measure the real page. The build fails if it is set on Vercel or CI.
 */
const gateDisabled = assertGateAuditAllowed(process.env);

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { title, gate } = await loadGlobal();
  // Smooth scroll lives inside the gate: it only starts once the site is unlocked.
  const site = <SmoothScroll>{children}</SmoothScroll>;
  return (
    <html lang={copy.htmlLang} className={archivo.variable}>
      <body>{gateDisabled || !gate ? site : <Gate hash={gateHash()} title={title}>{site}</Gate>}</body>
    </html>
  );
}
