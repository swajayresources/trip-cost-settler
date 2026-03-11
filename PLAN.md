# Trip Cost Settler — Implementation Plan
> CHECKPOINT 1 of 6 | Status: AWAITING YOUR CONFIRMATION

---

## Stack Decisions (and why)

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | React (via Next.js) | React is the UI library. Next.js is the framework that wraps it — you get React components + routing + API routes in one repo |
| **Language** | TypeScript | Type safety across frontend AND backend in one codebase. Interview evaluators specifically look for this |
| **Styling** | Tailwind CSS + shadcn/ui | Pre-built accessible components (dialogs, badges, buttons). You get a polished UI in hours not days |
| **Backend** | Next.js API Routes | Same repo as frontend — no separate Express server. Routes live in `src/app/api/` |
| **LLM** | Claude API (Anthropic SDK) | The spec says use AI for parsing. Claude is mandatory since you're showing Claude Code workflow |
| **Currency** | USD ($) | Default currency is dollars |
| **Database** | SQLite + Prisma | **Localhost** — no external DB needed. The spec says "run locally". SQLite is a single `.db` file. Prisma gives you typed queries |
| **Hosting** | **localhost only** | Spec says "clear instructions to run locally". No Vercel, no deployment needed |
| **Testing** | Vitest + Playwright | Vitest for unit/integration (fast, works with Next.js). Playwright for full E2E browser tests |
| **Validation** | Zod | Validates LLM output before it touches the DB. Prevents Claude hallucinations from corrupting data |

**The short version**: React is the frontend. TypeScript is the language. Next.js bundles both with an API backend. Everything runs on your laptop. No Vercel.

---

## What the App Does (4 screens)

```
[Screen 1: Paste]          [Screen 2: Verify]         [Screen 3: Settle]         [Screen 4: Share]

┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│                 │        │ Mick paid $240  │        │ NET POSITIONS   │        │ PAYMENTS        │
│  Paste messy    │  LLM   │ [Edit] [Delete] │  Algo  │ Mick   +$120   │  URL   │                 │
│  WhatsApp text  │ ────▶  │                 │ ────▶  │ Shazza  -$80   │ ────▶  │ Shazza → Mick   │
│  here...        │        │ Shazza paid 120 │        │ Dazza   -$40   │        │ $80   [CONFIRM] │
│                 │        │ [Edit] [Delete] │        │                │        │                 │
│  [Parse →]      │        │                 │        │ INSTRUCTIONS   │        │ Dazza → Mick    │
│                 │        │ [+ Add Expense] │        │ Shazza → Mick  │        │ $40   [CONFIRM] │
│                 │        │                 │        │ $80            │        │                 │
│                 │        │ [Confirm & Calc]│        │ Dazza → Mick   │        │ [Add Late Exp.] │
└─────────────────┘        └─────────────────┘        │ $40            │        └─────────────────┘
                                                       │                │
                                                       │ [Share URL →]  │
                                                       └─────────────────┘
```

---

## Data Model

```
Trip
  id            String    (short ID, e.g. "abc12345" — this becomes the share URL)
  title         String?   ("Goa Trip 2025")
  rawText       String    (the original messy paste — never modified)
  currency      String    default "USD"   ($)
  status        DRAFT → VERIFIED → SETTLED → RESETTLED
  createdAt     DateTime
  updatedAt     DateTime

Participant
  id            String
  tripId        → Trip
  name          String    ("Raj")
  normalizedName String   ("raj" — for detecting duplicates like "RAJ" vs "Raj")

Expense
  id            String
  tripId        → Trip
  payerId       → Participant  (who paid)
  description   String    ("Hotel 3 nights")
  amount        Int       (stored in CENTS to avoid floating point bugs — 4500.00 = 450000)
  isLateAddition Boolean  (true if added after settlement started)
  createdAt     DateTime

ExpenseParticipant  (who shared each expense)
  expenseId     → Expense
  participantId → Participant

Settlement
  id            String
  tripId        → Trip
  version       Int       (1 = first, 2 = after late expense, etc.)
  createdAt     DateTime

Payment
  id            String
  settlementId  → Settlement
  fromId        → Participant  (who pays)
  toId          → Participant  (who receives)
  amount        Int       (cents)
  status        PENDING | CONFIRMED
  confirmedAt   DateTime?     (when organiser marked it done)
```

---

## Folder Structure

```
trip-cost-settler/
│
├── prisma/
│   ├── schema.prisma              ← All database tables defined here
│   └── migrations/                ← Auto-generated by Prisma
│
├── src/
│   ├── app/                       ← Next.js App Router pages
│   │   ├── layout.tsx             ← Root layout (fonts, metadata)
│   │   ├── page.tsx               ← Screen 1: Paste input
│   │   ├── globals.css            ← Tailwind
│   │   │
│   │   ├── trip/[tripId]/
│   │   │   ├── verify/page.tsx    ← Screen 2: Review & edit expenses
│   │   │   ├── settle/page.tsx    ← Screen 3: Settlement results
│   │   │   └── share/page.tsx     ← Screen 4: Shareable coordination page
│   │   │
│   │   └── api/                   ← Backend API routes (no separate server)
│   │       └── trips/
│   │           ├── route.ts                              POST /api/trips
│   │           └── [tripId]/
│   │               ├── route.ts                          GET  /api/trips/:id
│   │               ├── verify/route.ts                   POST /api/trips/:id/verify
│   │               ├── settle/route.ts                   POST /api/trips/:id/settle
│   │               ├── settle/late-expense/route.ts      POST /api/trips/:id/settle/late-expense
│   │               ├── expenses/route.ts                 GET, POST
│   │               ├── expenses/[expenseId]/route.ts     PATCH, DELETE
│   │               ├── participants/route.ts             GET, POST (merge)
│   │               └── payments/[paymentId]/route.ts     PATCH (confirm)
│   │
│   ├── lib/                       ← Pure business logic (most heavily tested)
│   │   ├── db.ts                  ← Prisma client singleton
│   │   ├── anthropic.ts           ← Claude API client singleton
│   │   ├── parse-expenses.ts      ← LLM prompt + response parsing
│   │   ├── settlement-algorithm.ts ← Min-cash-flow algorithm (pure function)
│   │   ├── late-expense-resolver.ts ← Recalculate with immutable payments
│   │   ├── schemas.ts             ← Zod validation schemas
│   │   └── utils.ts               ← formatCurrency, etc.
│   │
│   ├── components/                ← React UI components
│   │   ├── ui/                    ← shadcn/ui primitives (auto-generated)
│   │   ├── text-input-form.tsx    ← The paste box
│   │   ├── trip-stepper.tsx       ← Step 1 → 2 → 3 → 4 indicator
│   │   ├── expense-card.tsx       ← Single expense row with edit/delete
│   │   ├── expense-edit-dialog.tsx ← Modal to edit payer/amount/participants
│   │   ├── participant-manager.tsx ← Merge duplicate participants
│   │   ├── net-positions-table.tsx ← Who owes / is owed (the math proof)
│   │   ├── settlement-instructions.tsx ← "Priya pays Raj ₹800"
│   │   ├── payment-tracker.tsx    ← Cards on share page with confirm button
│   │   └── late-expense-dialog.tsx ← Add forgotten expense dialog
│   │
│   └── types/index.ts             ← Shared TypeScript types
│
├── __tests__/
│   ├── unit/
│   │   ├── settlement-algorithm.test.ts   ← TDD — written BEFORE algorithm
│   │   ├── late-expense-resolver.test.ts  ← TDD — written BEFORE resolver
│   │   └── parse-expenses.test.ts         ← Mock Claude responses
│   ├── integration/
│   │   └── api-*.test.ts                  ← Test API routes with real DB
│   └── e2e/
│       ├── full-flow.spec.ts              ← Paste → Share in Playwright
│       └── late-expense.spec.ts           ← Bonus flow
│
├── .env.local                     ← ANTHROPIC_API_KEY=sk-ant-...
├── .env.example                   ← Template (committed to git)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── README.md                      ← Setup instructions + demo script
```

---

## The Settlement Algorithm (min-cash-flow)

The spec says "minimum set of directed payments" — this is a known CS problem.

**Example**: 4 people, 5 expenses paid.

Step 1 — Calculate net for each person:
```
Mick   paid $650, owes $280  → net = +$370  (is owed money)
Shazza paid $270, owes $340  → net = -$70   (owes money)
Dazza  paid $600, owes $560  → net = +$40   (is owed money)
Bazza  paid $140, owes $480  → net = -$340  (owes money)
```

Step 2 — Greedy match largest creditor vs largest debtor:
```
Bazza owes $340, Mick is owed $370
→  Bazza pays Mick $340       (Bazza settled, Mick still owed $30)
→  Shazza pays Mick $30       (Mick settled, Shazza still owes $40)
→  Shazza pays Dazza $40      (everyone settled)

Result: 3 transactions (vs up to 12 pairwise)
```

**Important implementation detail**: Amounts stored as **integer cents** ($45.00 = 4500) to avoid floating point errors like `0.1 + 0.2 = 0.30000000000004`.

---

## The Bonus: Late Expense

```
BEFORE:                    SETTLEMENT v1:              AFTER LATE EXPENSE:
Mick:  paid $650          Bazza → Mick $340 ✅DONE    New calculation:
Shazza paid $270          Shazza → Mick $30  pending  Bazza forgot: paid $120 rental car
Dazza: paid $600          Shazza → Dazza $40 pending  (only Mick + Bazza + Shazza)
Bazza: paid $140

                                                        SETTLEMENT v2:
                                                        Bazza → Mick $340 ✅ DONE (immutable)
                                                        Shazza → Mick $70  ← revised up
                                                        Shazza → Dazza $20 ← revised down
```

The resolved payments (Sam → Raj ₹3400) cannot be undone — real money moved.
The algorithm subtracts confirmed payments from the recalculated balances and produces only the *incremental* new payments needed.

---

## API Routes

| Method | Route | What it does |
|--------|-------|-------------|
| POST | `/api/trips` | Create trip + parse raw text with Claude |
| GET | `/api/trips/:id` | Get full trip (expenses, participants, settlement) |
| GET | `/api/trips/:id/expenses` | List expenses |
| POST | `/api/trips/:id/expenses` | Add expense manually |
| PATCH | `/api/trips/:id/expenses/:expId` | Edit expense |
| DELETE | `/api/trips/:id/expenses/:expId` | Delete expense |
| GET | `/api/trips/:id/participants` | List participants |
| POST | `/api/trips/:id/participants` | Merge duplicate participants |
| POST | `/api/trips/:id/verify` | Lock expenses, mark trip verified |
| POST | `/api/trips/:id/settle` | Run algorithm, create settlement |
| POST | `/api/trips/:id/settle/late-expense` | Add late expense + recalculate |
| PATCH | `/api/trips/:id/payments/:payId` | Mark payment confirmed |

---

## Build Phases

| Phase | What | Hours |
|-------|------|-------|
| 1 | Scaffold + Prisma schema + Zod schemas + settlement algorithm (TDD first) | ~3h |
| 2 | Claude API parsing integration + create-trip API | ~3h |
| 3 | Screens 1 & 2 (paste form + verification UI + expense CRUD) | ~3h |
| 4 | Screen 3 & 4 (settlement results + shareable coordination page) | ~3h |
| 5 | Bonus: late expense API + UI | ~2h |
| 6 | Error handling, tests, README, demo polish | ~3h |

**Total estimate: 17 hours** (fits "2–5 hours" per session across 4 sessions)

---

## Demo Input (prepared for interview day)

```
hey team here's what everyone paid on the byron bay trip

Mick put $480 on his card for the airbnb (all 4 of us)
Shazza got the airport uber - $95
First night dinner was on me (Dazza) - $210, whole group
Mick also paid for the surf lessons $160, just him shazza and bazza
Bazza shouted breakfast day 2 - $88
shazza paid for the kayak hire $120 (just her and dazza)
I (Dazza) grabbed dinner on day 2 - $195, all of us
bazza got snacks and drinks for the beach - around $65
```

This demonstrates: multiple payers, self-references ("me", "I"), subset participation, informal amounts ("around $65"), mixed capitalisation, Aussie slang ("shouted").

---

## Setup Instructions (what README will contain)

```bash
git clone <repo>
cd trip-cost-settler
pnpm install

# Add your Claude API key
cp .env.example .env.local
# Edit .env.local: ANTHROPIC_API_KEY=sk-ant-...

# Set up the database
pnpm prisma migrate dev

# Run
pnpm dev
# Open http://localhost:3000
```

---

> **AWAITING CONFIRMATION**
>
> Reply `yes` → proceed to CHECKPOINT 2 (Architecture review by architect agent)
> Reply `no` → abort
> Reply `modify: [your changes]` → e.g. "modify: use rupees as default currency" or "modify: skip E2E tests" or "modify: add a receipt photo upload"
