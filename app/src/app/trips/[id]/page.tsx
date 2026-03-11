"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Edit2, Plus, Trash2, Users, Save, X, ArrowRight, ShieldCheck, UserPlus, Receipt } from "lucide-react";
import type { Trip, Participant } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

function displayToCents(s: string): number {
  return Math.round(parseFloat(s.replace(/[^0-9.]/g, "")) * 100);
}

// ─── Expense form state ───────────────────────────────────────────────────────
interface ExpenseFormState {
  description: string;
  amountDisplay: string;
  payerId: string;
  participantIds: string[];
}

function blankForm(participants: Participant[]): ExpenseFormState {
  return {
    description: "",
    amountDisplay: "",
    payerId: participants[0]?.id ?? "",
    participantIds: participants.map((p) => p.id),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ExpenseFormFields({ form, participants, onChange }: { form: ExpenseFormState; participants: Participant[]; onChange: (f: ExpenseFormState) => void; }) {
  function toggleParticipant(id: string) {
    const next = form.participantIds.includes(id)
      ? form.participantIds.filter((x) => x !== id)
      : [...form.participantIds, id];
    onChange({ ...form, participantIds: next });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="e.g. Airbnb, Groceries"
          className="w-full rounded-xl bg-zinc-900/50 border border-white/10 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amountDisplay}
              onChange={(e) => onChange({ ...form, amountDisplay: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-xl bg-zinc-900/50 border border-white/10 pl-7 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Paid by</label>
          <select
            value={form.payerId}
            onChange={(e) => onChange({ ...form, payerId: e.target.value })}
            className="w-full rounded-xl bg-zinc-900/50 border border-white/10 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 appearance-none transition-all"
          >
            {participants.map((p) => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Split among</label>
          <button type="button" onClick={() => onChange({ ...form, participantIds: participants.map((p) => p.id) })} className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider hover:text-indigo-300">Select all</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => {
            const isChecked = form.participantIds.includes(p.id);
            return (
              <label key={p.id} className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg border ${isChecked ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-white/5 bg-zinc-900/30 text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'} px-3 py-1.5 transition-all`}>
                <input type="checkbox" className="hidden" checked={isChecked} onChange={() => toggleParticipant(p.id)} />
                <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-indigo-400' : 'bg-zinc-700'}`} />
                {p.name}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VerifyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editingParticipantName, setEditingParticipantName] = useState("");

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExpenseFormState | null>(null);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addForm, setAddForm] = useState<ExpenseFormState>({ description: "", amountDisplay: "", payerId: "", participantIds: [] });
  const [settling, setSettling] = useState(false);

  const loadTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) { setError("Trip not found."); return; }
      const data = await res.json();
      const t: Trip = data;
      setTrip(t);
      if (t.participants.length > 0) setAddForm(blankForm(t.participants));
      if (t.status === "SETTLED" || t.status === "RESETTLED") router.replace(`/trips/${id}/settle`);
    } catch { setError("Failed to load trip data."); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  async function renameParticipant(pid: string, name: string) {
    if (!name.trim()) return;
    const res = await fetch(`/api/trips/${id}/participants/${pid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    if (!res.ok) { toast.error("Could not rename participant"); return; }
    setEditingParticipantId(null);
    toast.success("Participant updated");
    loadTrip();
  }

  async function deleteExpense(eid: string) {
    if (!window.confirm("Delete this expense? This cannot be undone.")) return;
    const res = await fetch(`/api/trips/${id}/expenses/${eid}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete expense"); return; }
    toast.success("Expense removed");
    loadTrip();
  }

  async function saveEditExpense(eid: string) {
    if (!editForm) return;
    const amountCents = displayToCents(editForm.amountDisplay);
    if (!editForm.description.trim() || isNaN(amountCents) || amountCents <= 0) { toast.error("Invalid amount or empty description."); return; }
    if (editForm.participantIds.length === 0) { toast.error("Select at least one participant."); return; }
    
    const res = await fetch(`/api/trips/${id}/expenses/${eid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editForm.description, amountCents, payerId: editForm.payerId, participantIds: editForm.participantIds }),
    });
    if (!res.ok) { toast.error("Update failed."); return; }
    setEditingExpenseId(null);
    toast.success("Expense saved!");
    loadTrip();
  }

  async function saveAddExpense() {
    const amountCents = displayToCents(addForm.amountDisplay);
    if (!addForm.description.trim() || isNaN(amountCents) || amountCents <= 0) { toast.error("Invalid amount or description."); return; }
    if (addForm.participantIds.length === 0) { toast.error("Select participants first."); return; }
    
    const res = await fetch(`/api/trips/${id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: addForm.description, amountCents, payerId: addForm.payerId, participantIds: addForm.participantIds }),
    });
    if (!res.ok) { toast.error("Could not add expense."); return; }
    setShowAddExpense(false);
    toast.success("Expense added.");
    loadTrip();
  }

  async function verifyAndSettle() {
    setSettling(true);
    try {
      const vRes = await fetch(`/api/trips/${id}/verify`, { method: "POST" });
      if (!vRes.ok) throw new Error((await vRes.json()).error);
      const sRes = await fetch(`/api/trips/${id}/settle`, { method: "POST" });
      if (!sRes.ok) throw new Error((await sRes.json()).error);
      toast.success("Settlement calculated successfully!", { icon: "🎉" });
      router.push(`/trips/${id}/settle`);
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize the trip.");
    } finally {
      setSettling(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
      <p className="text-zinc-500 font-medium animate-pulse">Loading trip details...</p>
    </div>
  );
  if (error || !trip) return <div className="text-center py-20 text-red-400 font-medium">{error || "Trip not found"}</div>;

  const currency = trip.currency ?? "USD";
  const totalCents = trip.expenses.reduce((s, e) => s + e.amountCents, 0);
  const canSettle = trip.participants.length >= 2 && trip.expenses.length >= 1;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" /> Verification Phase
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{trip.title}</h1>
          <p className="text-zinc-500 mt-1">Review the AI-extracted data. You are the source of truth.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Participants Panel */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-[#0d0d12] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full shadow-xl">
            <div className="bg-[#09090b]/80 border-b border-white/5 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <Users className="w-4 h-4 text-indigo-400" /> Crew 
                <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md text-xs">{trip.participants.length}</span>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-[250px] space-y-2">
              <AnimatePresence>
                {trip.participants.map((p) => (
                  <motion.div layout key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="group flex items-center justify-between p-2 rounded-xl bg-zinc-900/30 hover:bg-zinc-900/80 border border-transparent hover:border-white/5 transition-all">
                    {editingParticipantId === p.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          autoFocus
                          value={editingParticipantName}
                          onChange={(e) => setEditingParticipantName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameParticipant(p.id, editingParticipantName); if (e.key === "Escape") setEditingParticipantId(null); }}
                          className="flex-1 w-full bg-black/50 border border-indigo-500/50 rounded-lg px-2 py-1 text-sm text-zinc-200 outline-none"
                        />
                        <button onClick={() => renameParticipant(p.id, editingParticipantName)} className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingParticipantId(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 w-full overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                            {p.name.slice(0, 2)}
                          </div>
                          <span className="text-sm font-medium text-zinc-300 truncate">{p.name}</span>
                        </div>
                        <button onClick={() => { setEditingParticipantId(p.id); setEditingParticipantName(p.name); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all shrink-0">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Expenses Panel */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-[#0d0d12] rounded-2xl border border-white/5 shadow-xl flex flex-col h-full overflow-hidden">
            <div className="bg-[#09090b]/80 border-b border-white/5 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-zinc-300 font-semibold flex items-center gap-2">
                  Expenses <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md text-xs">{trip.expenses.length}</span>
                </h2>
                <div className="h-4 w-px bg-white/10" />
                <span className="font-mono text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  Total: {fmt(totalCents, currency)}
                </span>
              </div>
              <button onClick={() => { setShowAddExpense(true); setEditingExpenseId(null); }} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-full transition-colors">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {showAddExpense && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4">
                    <div className="bg-zinc-900 border border-indigo-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                      <div className="flex items-center gap-2 mb-4 text-indigo-400 font-semibold text-sm">
                        <Plus className="w-4 h-4" /> Add Missing Expense
                      </div>
                      <ExpenseFormFields form={addForm} participants={trip.participants} onChange={setAddForm} />
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                        <button onClick={saveAddExpense} className="flex-1 bg-indigo-500 text-white font-semibold py-2 rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" /> Save
                        </button>
                        <button onClick={() => setShowAddExpense(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold py-2 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {trip.expenses.map((e) => {
                  const participantNames = e.participants.map((ep) => ep.participant.name);
                  const isAll = participantNames.length === trip.participants.length;
                  const isEditing = editingExpenseId === e.id;

                  return (
                    <motion.div layout key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl p-4 ${isEditing ? 'bg-zinc-900 border border-indigo-500/30 shadow-lg' : 'bg-zinc-900/30 border border-white/5 hover:bg-zinc-900/60 transition-colors'} group`}>
                      {isEditing && editForm ? (
                        <div>
                          <ExpenseFormFields form={editForm} participants={trip.participants} onChange={setEditForm} />
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                            <button onClick={() => saveEditExpense(e.id)} className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Save changes</button>
                            <button onClick={() => setEditingExpenseId(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white bg-transparent hover:bg-white/5 rounded-lg transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex relative items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-zinc-100 truncate text-base mb-1.5">{e.description}</h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span className="text-zinc-400">Paid by <span className="font-medium text-indigo-300">{e.payer.name}</span></span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-500 flex items-center gap-1"><Users className="w-3 h-3 text-zinc-600" /> {isAll ? "Everyone" : participantNames.join(", ")}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="font-mono text-base font-semibold text-zinc-200">{fmt(e.amountCents, currency)}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingExpenseId(e.id); setShowAddExpense(false); setEditForm({ description: e.description, amountDisplay: (e.amountCents / 100).toFixed(2), payerId: e.payer.id, participantIds: e.participants.map(ep => ep.participant.id) }); }} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                {trip.expenses.length === 0 && !showAddExpense && (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-500 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                    <Receipt className="w-8 h-8 mb-3 opacity-50" />
                    <p className="text-sm">No expenses detected. Add one manually to get started.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Settle Action Bar (Pinned Bottom / Action area) */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8">
        <div className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-indigo-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="max-w-md text-center sm:text-left">
            <h3 className="font-semibold text-zinc-100 flex items-center justify-center sm:justify-start gap-2 mb-1">
              <Check className="w-4 h-4 text-indigo-400" /> Ready to finalize?
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Once verified, our algorithm will calculate the absolute minimum number of payments needed to make everyone square.
            </p>
            {!canSettle && (
              <p className="text-xs text-red-400 font-medium mt-2 bg-red-500/10 inline-block px-2 py-1 rounded">
                Require ≥ 2 participants and ≥ 1 expense.
              </p>
            )}
          </div>
          <button
            onClick={verifyAndSettle}
            disabled={settling || !canSettle}
            className="w-full sm:w-auto shrink-0 relative group overflow-hidden rounded-xl bg-white px-8 py-3.5 font-bold text-[#09090b] shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            {settling ? (
              <><span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Calculating...</>
            ) : (
              <>Lock & Calculate <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
