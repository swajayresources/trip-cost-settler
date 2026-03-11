"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCircle2, Wallet, Users, Clock, ArrowRight } from "lucide-react";
import type { Trip, Settlement, Payment } from "@/types";

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

interface ShareData {
  trip: Trip;
  settlement: Settlement | null;
}

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) { setError("Trip not found or link is invalid."); return; }
      const json = await res.json();
      setData(json);
    } catch { setError("Failed to load trip."); }
    finally { setLoading(false); }
  }

  async function confirmPayment(pid: string) {
    if (!data) return;
    const res = await fetch(`/api/trips/${data.trip.id}/payments/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    if (!res.ok) { toast.error("Could not confirm payment"); return; }
    toast.success("Payment marked as paid ✓");
    loadData();
  }

  useEffect(() => { loadData(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
      <p className="text-zinc-500 font-medium animate-pulse">Loading secure trip details...</p>
    </div>
  );
  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-red-400 font-medium text-lg">{error ?? "Trip not found."}</p>
      <a href="/" className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-colors text-sm">← Back to Home</a>
    </div>
  );

  const { trip, settlement } = data;
  const currency = trip.currency ?? "USD";
  const payments: Payment[] = settlement?.payments ?? [];
  const confirmedCount = payments.filter((p) => p.status === "CONFIRMED").length;
  const totalCents = trip.expenses.reduce((s, e) => s + e.amountCents, 0);
  const pctComplete = payments.length > 0 ? Math.round((confirmedCount / payments.length) * 100) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-3xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-white/5 space-y-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">{trip.title}</h1>
        <div className="flex items-center justify-center gap-3 text-sm text-zinc-400">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">
             <Users className="w-4 h-4" /> {trip.participants.length} Active Participants
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">
             {fmt(totalCents, currency)} Total Value
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-xl">
          {trip.participants.map((p) => (
            <span key={p.id} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-white/5">
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {settlement ? (
        <div className="space-y-6">
          {/* Progress Circular */}
          <div className="flex items-center justify-between bg-zinc-900/50 border border-white/5 px-5 py-4 rounded-2xl">
             <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 transform -rotate-90">
                      <path className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-emerald-400 transition-all duration-1000 ease-out" strokeDasharray={`${pctComplete}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-zinc-200">{pctComplete}%</span>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-200">Payment Status</h3>
                  <p className="text-sm text-zinc-400">{confirmedCount} out of {payments.length} transactions completed</p>
                </div>
             </div>
             {pctComplete === 100 && payments.length > 0 && (
                <span className="shrink-0 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Fully Settled
                </span>
             )}
          </div>

          <div className="bg-[#0d0d12] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
            <div className="bg-[#09090b]/80 border-b border-white/5 px-5 py-4">
              <h2 className="text-zinc-300 font-semibold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Action Plan
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {payments.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">All settled up seamlessly! 🎉</div>
              ) : (
                <AnimatePresence>
                  {payments.map((payment, i) => {
                    const isConfirmed = payment.status === "CONFIRMED";
                    return (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.1 } }} key={payment.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${isConfirmed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900'} transition-all`}>
                        <div className="flex-1 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${isConfirmed ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                            {payment.from.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs uppercase tracking-wider font-semibold ${isConfirmed ? 'text-emerald-500/70' : 'text-zinc-500'}`}>Pays</span>
                            <span className={`font-semibold ${isConfirmed ? 'text-zinc-300 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{payment.from.name}</span>
                          </div>
                          
                          <div className="flex-1 flex items-center justify-center px-2">
                            <div className={`h-px w-full bg-gradient-to-r ${isConfirmed ? 'from-transparent via-emerald-500/30 to-transparent' : 'from-transparent via-white/20 to-transparent'}`} />
                            <ArrowRight className={`shrink-0 mx-2 w-4 h-4 ${isConfirmed ? 'text-emerald-500/50' : 'text-zinc-600'}`} />
                            <div className={`h-px w-full bg-gradient-to-r ${isConfirmed ? 'from-transparent via-emerald-500/30 to-transparent' : 'from-transparent via-white/20 to-transparent'}`} />
                          </div>

                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${isConfirmed ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'}`}>
                            {payment.to.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col text-right">
                            <span className={`text-xs uppercase tracking-wider font-semibold ${isConfirmed ? 'text-emerald-500/70' : 'text-zinc-500'}`}>Receives</span>
                            <span className={`font-semibold ${isConfirmed ? 'text-zinc-300' : 'text-zinc-100'}`}>{payment.to.name}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0 border-l border-white/5 pl-4">
                          <span className={`font-mono text-lg font-bold ${isConfirmed ? 'text-emerald-400' : 'text-zinc-200'}`}>
                            {fmt(payment.amountCents, currency)}
                          </span>
                          {isConfirmed ? (
                            <div className="flex flex-col items-end">
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500/70 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                                <Check className="w-3 h-3" /> Confirmed
                              </span>
                              {payment.confirmedAt && <span className="text-[10px] text-zinc-500 mt-1">{new Date(payment.confirmedAt).toLocaleDateString()}</span>}
                            </div>
                          ) : (
                            <button onClick={() => confirmPayment(payment.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs font-semibold text-zinc-300 transition-colors border border-transparent hover:border-emerald-500/30">
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 text-center max-w-lg mx-auto">
          <Clock className="w-8 h-8 text-amber-500/50 mx-auto mb-3" />
          <h3 className="text-amber-400 font-semibold mb-1">Settlement Pending</h3>
          <p className="text-sm text-amber-500/70">The organiser is still reviewing and verifying the expenses. Check back soon when they finalize the algorithm.</p>
        </div>
      )}

      {/* Expenses Ledger */}
      <div className="bg-[#0d0d12] rounded-2xl border border-white/5 p-6 mt-8">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center justify-between">
          Ledger <span className="text-zinc-500 font-mono lowercase">{fmt(totalCents, currency)} total</span>
        </h2>
        <div className="space-y-4">
          {trip.expenses.map((e) => {
             const names = e.participants.map((ep) => ep.participant.name);
             const allIn = names.length === trip.participants.length;
             return (
              <div key={e.id} className="flex flex-col sm:flex-row items-baseline justify-between gap-2 pb-4 border-b border-white/5 last:border-0 last:pb-0 group">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-zinc-200 font-medium truncate">{e.description}</p>
                    {e.isLateAddition && <span className="text-[9px] uppercase tracking-wider font-bold bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">Late addition</span>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Paid by <span className="text-zinc-400 font-medium">{e.payer.name}</span> • Split: {allIn ? "Everyone" : names.join(", ")}
                  </p>
                </div>
                <span className="font-mono font-medium text-zinc-300 group-hover:text-white transition-colors shrink-0">{fmt(e.amountCents, currency)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center pb-8 pt-4">
        <p className="text-xs text-zinc-600">
          Powered by <a href="/" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium">Trip Cost Settler</a>
        </p>
      </div>
    </motion.div>
  );
}
