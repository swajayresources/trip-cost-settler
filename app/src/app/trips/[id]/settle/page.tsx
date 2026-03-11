"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Share2, Plus, ArrowRight, ShieldCheck, CheckCircle2, Clock, Wallet } from "lucide-react";
import type { Trip, Settlement, Participant } from "@/types";

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function displayToCents(s: string): number {
  return Math.round(parseFloat(s.replace(/[^0-9.]/g, "")) * 100);
}

interface LateForm {
  description: string;
  amountDisplay: string;
  payerId: string;
  participantIds: string[];
}

function blankLateForm(participants: Participant[]): LateForm {
  return { description: "", amountDisplay: "", payerId: participants[0]?.id ?? "", participantIds: participants.map((p) => p.id) };
}

export default function SettlePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLateForm, setShowLateForm] = useState(false);
  const [lateForm, setLateForm] = useState<LateForm>({ description: "", amountDisplay: "", payerId: "", participantIds: [] });
  const [resettling, setResettling] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tripRes, settlementRes] = await Promise.all([
        fetch(`/api/trips/${id}`),
        fetch(`/api/trips/${id}/settlements/latest`),
      ]);
      if (!tripRes.ok) { setError("Trip not found."); return; }
      const tripData = await tripRes.json();
      const t: Trip = tripData;
      setTrip(t);
      if (t.participants.length > 0) setLateForm(blankLateForm(t.participants));
      if (settlementRes.ok) {
        const sData = await settlementRes.json();
        setSettlement(sData);
      }
    } catch { setError("Failed to load settlement."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function confirmPayment(pid: string) {
    const res = await fetch(`/api/trips/${id}/payments/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    if (!res.ok) { toast.error("Could not confirm payment"); return; }
    toast.success("Payment confirmed ✓");
    loadData();
  }

  async function addLateExpense() {
    const amountCents = displayToCents(lateForm.amountDisplay);
    if (!lateForm.description.trim() || isNaN(amountCents) || amountCents <= 0) { toast.error("Please provide valid details."); return; }
    if (lateForm.participantIds.length === 0) { toast.error("Select participants tracking this expense."); return; }

    setResettling(true);
    try {
      const eRes = await fetch(`/api/trips/${id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: lateForm.description, amountCents, payerId: lateForm.payerId, participantIds: lateForm.participantIds, isLateAddition: true }),
      });
      if (!eRes.ok) throw new Error((await eRes.json()).error);

      const rRes = await fetch(`/api/trips/${id}/resettle`, { method: "POST" });
      if (!rRes.ok) throw new Error((await rRes.json()).error);

      setShowLateForm(false);
      toast.success("Recalculated successfully!", { icon: "🔄" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to fold in the late expense.");
    } finally {
      setResettling(false);
    }
  }

  function copyShareLink() {
    if (!trip) return;
    const url = `${window.location.origin}/share/${trip.shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Share link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
      <p className="text-zinc-500 font-medium animate-pulse">Loading settlement algorithm...</p>
    </div>
  );
  if (error || !trip) return <div className="text-center py-20 text-red-500">{error ?? "Trip not found."}</div>;

  const currency = trip.currency ?? "USD";
  const payments = settlement?.payments ?? [];
  const confirmedCount = payments.filter((p) => p.status === "CONFIRMED").length;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${trip.shareToken}` : "";
  const pctComplete = payments.length > 0 ? Math.round((confirmedCount / payments.length) * 100) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
            </span>
            {settlement && <span className="text-xs text-zinc-500 font-mono">v{settlement.version}</span>}
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{trip.title} <span className="text-zinc-600 font-light">Summary</span></h1>
          <p className="text-zinc-400 mt-2">Algorithm applied. The minimum directed payments are listed below.</p>
        </div>
        
        {/* Progress Circular */}
        <div className="flex items-center gap-3 bg-zinc-900/50 border border-white/5 px-4 py-2.5 rounded-2xl">
           <div className="relative w-10 h-10 flex items-center justify-center">
             <svg viewBox="0 0 36 36" className="w-10 h-10 transform -rotate-90">
                <path className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-emerald-400 transition-all duration-1000 ease-out" strokeDasharray={`${pctComplete}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
             </svg>
             <span className="absolute text-[10px] font-bold text-zinc-200">{pctComplete}%</span>
           </div>
           <div>
             <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Payments</p>
             <p className="text-sm font-medium text-emerald-400">{confirmedCount} of {payments.length} settled</p>
           </div>
        </div>
      </div>

      {/* Share Box */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-indigo-500/20 border border-indigo-500/30 rounded-full flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-zinc-100 font-semibold mb-1">Coordinate with the group</h3>
            <p className="text-sm text-zinc-400">Send this link so others can see who they owe and self-report their payments.</p>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="px-3 py-2 bg-black/40 border border-indigo-500/20 rounded-lg text-xs font-mono text-zinc-400 max-w-[150px] sm:max-w-xs truncate select-all">{shareUrl}</div>
            <button onClick={copyShareLink} className="flex items-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-4 py-2 text-sm text-white font-semibold transition-all shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Payments Flow / Center Stage */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-[#0d0d12] rounded-2xl border border-white/5 shadow-xl flex flex-col h-full overflow-hidden">
            <div className="bg-[#09090b]/80 border-b border-white/5 px-5 py-4 flex items-center justify-between">
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
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500/70 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                              <Check className="w-3 h-3" /> Confirmed
                            </span>
                          ) : (
                            <button onClick={() => confirmPayment(payment.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors">
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

        {/* Sidebar */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Expenses reference */}
          <div className="bg-[#0d0d12] rounded-2xl border border-white/5 shadow-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-between">
              Ledger <span className="text-zinc-500 font-mono lowercase">{fmt(trip.expenses.reduce((s, e) => s + e.amountCents, 0), currency)} total</span>
            </h2>
            <div className="space-y-3">
              {trip.expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm group">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-zinc-300 truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500">by {e.payer.name}</span>
                      {e.isLateAddition && <span className="text-[9px] uppercase tracking-wider font-bold bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">Late</span>}
                    </div>
                  </div>
                  <span className="font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0">{fmt(e.amountCents, currency)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bonus Challenge: Late Expense */}
          {(trip.status === "SETTLED" || trip.status === "RESETTLED") && (
            <div className="bg-gradient-to-b from-orange-500/5 to-transparent border border-orange-500/20 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-orange-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Late Expense? 
                </h2>
                <button onClick={() => setShowLateForm(!showLateForm)} className="text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors">
                  {showLateForm ? "Close" : "Add"}
                </button>
              </div>
              <p className="text-xs text-orange-300/60 leading-relaxed mb-4">
                Forgot something? Confirmed payments are preserved forever. New amounts are seamlessly redistributed over the top.
              </p>

              <AnimatePresence>
                {showLateForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                    <div className="space-y-3 pt-2">
                      <div>
                        <input type="text" value={lateForm.description} onChange={(e) => setLateForm({ ...lateForm, description: e.target.value })} placeholder="e.g. Airport Parking..." className="w-full bg-black/40 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500" />
                      </div>
                      <div className="flex gap-2">
                        <input type="number" step="0.01" value={lateForm.amountDisplay} onChange={(e) => setLateForm({ ...lateForm, amountDisplay: e.target.value })} placeholder="Amount ($)" className="w-1/2 bg-black/40 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500" />
                        <select value={lateForm.payerId} onChange={(e) => setLateForm({ ...lateForm, payerId: e.target.value })} className="w-1/2 bg-black/40 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500">
                          {trip.participants.map((p) => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {trip.participants.map((p) => {
                          const active = lateForm.participantIds.includes(p.id);
                          return (
                            <label key={p.id} className={`cursor-pointer px-2 py-1 rounded-md text-xs font-medium border transition-colors ${active ? 'bg-orange-500/20 border-orange-500/30 text-orange-300' : 'bg-black/30 border-white/5 text-zinc-500'}`}>
                              <input type="checkbox" className="hidden" checked={active} onChange={() => {
                                setLateForm(prev => ({ ...prev, participantIds: active ? prev.participantIds.filter(id => id !== p.id) : [...prev.participantIds, p.id] }));
                              }} />
                              {p.name}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <button onClick={addLateExpense} disabled={resettling} className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                      {resettling ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Clock className="w-4 h-4" />}
                      {resettling ? "Recalculating..." : "Fold into Settlement"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
