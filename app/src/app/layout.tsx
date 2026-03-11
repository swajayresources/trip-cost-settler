import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Trip Cost Settler",
  description: "Split trip expenses fairly, the easy way.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans min-h-screen bg-[#09090b] text-zinc-50 antialiased selection:bg-indigo-500/30`}>
        <div className="fixed inset-0 z-[-1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-[#09090b] to-[#09090b]"></div>
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/60 backdrop-blur-xl transition-all">
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
            <a href="/" className="font-outfit flex items-center gap-3 text-xl font-semibold tracking-tight text-zinc-100 hover:text-white transition-colors">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md border border-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              Settler
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">{children}</main>
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
}
