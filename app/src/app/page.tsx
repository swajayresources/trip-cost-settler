"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Receipt, Users, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_TEXT = `Byron Bay Long Weekend – Aug 2025

Mick booked the Airbnb for 3 nights, total $840.
Shazza filled up the car on the way down, $95 (Mick, Shazza, Dazza, Bazza).
Dazza bought groceries for the whole group, $230.
Bazza organised the surf lesson for everyone, $320.
Mick paid for dinner at the Beach Hotel on Friday night, $385 split between all.
Shazza got brunch Saturday for everyone, $165.
Dazza shouted beers at the pub Saturday night, $140 (just Mick, Dazza, Bazza).
Bazza bought snacks and drinks for the drive home, $55 (all four).`;

export default function HomePage() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;
    setLoading(true);
    
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, title: title.trim() || undefined }),
      });
      
      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (err) {
        toast.error(`Server returned a non-JSON response (Status: ${res.status}): ${text.substring(0, 50)}...`);
        console.error("Non-JSON API response:", text);
        return;
      }
      
      if (!res.ok) {
        toast.error(data.error ?? "Failed to parse trip. Check your text and try again.");
        return;
      }
      toast.success("Trip parsed successfully!");
      router.push(`/trips/${data.tripId}`);
    } catch (error: any) {
      toast.error(`Network error: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-16">
      <section className="text-center pt-8 pb-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-sm font-medium mb-6 backdrop-blur-sm"
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI-Powered Expense Engine</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="font-outfit text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
        >
          Paste the mess. <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-[length:150%_150%] animate-gradient">
            We do the math.
          </span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
        >
          Forget manual spreadsheets and WhatsApp math. Just paste your unstructured group chat messages exactly as they are. Our AI parses every expense and calculates the minimum settlements to make everyone square.
        </motion.p>
      </section>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, type: "spring" }}
      >
        <form onSubmit={handleSubmit} className="relative group">
          <div className={cn(
            "absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 via-cyan-500 to-indigo-500 opacity-20 blur transition duration-500",
            isFocused && "opacity-40 animate-pulse duration-1000"
          )} />
          
          <div className="relative bg-[#0d0d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col">
            <div className="flex bg-[#09090b]/80 border-b border-white/5 px-4 py-3 pb-0">
               <input
                 type="text"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 onFocus={() => setIsFocused(true)}
                 onBlur={() => setIsFocused(false)}
                 placeholder="Trip Name (e.g. Byron Bay 😎)"
                 className="w-full bg-transparent border-none text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-0 text-lg font-medium py-2 px-2"
               />
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required
              rows={8}
              placeholder="Paste your chaotic chat messages here...&#10;&#10;e.g. 'Mick paid $840 for Airbnb, Shazza got petrol for $95 (Mick, Shazza, Dazza, Bazza)...'"
              className="w-full bg-transparent border-none resize-none px-6 py-6 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-0 font-mono text-sm leading-relaxed outline-none"
            />
            
            <div className="flex items-center justify-between px-6 py-4 bg-[#09090b]/80 border-t border-white/5">
               <div className="flex items-center gap-3">
                 <button
                   type="button"
                   onClick={() => { setRawText(DEMO_TEXT); setTitle("Byron Bay Long Weekend"); toast.success("Demo data loaded!"); }}
                   className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors"
                 >
                   Load demo template
                 </button>
                 <span className="text-xs text-zinc-600 hidden sm:inline-block">
                    {rawText.length.toLocaleString()} chars
                 </span>
               </div>
               
               <button
                 type="submit"
                 disabled={loading || !rawText.trim()}
                 className="group relative flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#09090b] transition-all hover:bg-zinc-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
               >
                 {loading ? (
                   <>
                     <span className="h-4 w-4 border-2 border-[#09090b]/20 border-t-[#09090b] rounded-full animate-spin" />
                     Parsing...
                   </>
                 ) : (
                   <>
                     Process Magic
                     <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                   </>
                 )}
               </button>
            </div>
          </div>
        </form>
      </motion.div>
      
      {/* Features Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="grid sm:grid-cols-3 gap-6 pt-8 border-t border-white/5"
      >
        {[
          { icon: Receipt, title: "Unstructured Input", desc: "No tables or weird formats. Just paste whatever you sent in the group chat." },
          { icon: Users, title: "Agentic Verification", desc: "Review and edit exactly what our AI models pulled from your text." },
          { icon: CheckCircle2, title: "Minimal Transactions", desc: "Our algorithm boils everything down to the fewest payments possible." },
        ].map((feat, i) => (
          <div key={i} className="flex flex-col items-center sm:items-start text-center sm:text-left p-4 rounded-xl hover:bg-white/[0.02] transition-colors">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <feat.icon className="h-5 w-5" />
            </div>
            <h3 className="text-zinc-200 font-semibold mb-2">{feat.title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Tailwind specific custom animation config */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 6s ease infinite;
        }
      `}} />
    </div>
  );
}
