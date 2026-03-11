# Trip Cost Settler — Architecture
> CHECKPOINT 2 of 6 | Status: APPROVED

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 15.2.x |
| Language | TypeScript | 5.7.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | latest |
| Database | SQLite via Prisma | Prisma 6.x |
| Validation | Zod | 3.24.x |
| IDs | nanoid | 5.x |
| AI | @anthropic-ai/sdk | 0.39.x |
| Unit Tests | Vitest | 3.x |
| E2E Tests | Playwright | 1.50.x |
| Runtime | Node.js | 22 LTS |

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Trip {
  id         String   @id @default(cuid())
  title      String   @default("")
  rawText    String
  currency   String   @default("USD")
  status     String   @default("DRAFT") // DRAFT | VERIFIED | SETTLED | RESETTLED
  shareToken String   @unique
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  participants Participant[]
  expenses     Expense[]
  settlements  Settlement[]
}

model Participant {
  id             String   @id @default(cuid())
  tripId         String
  name           String
  normalizedName String
  createdAt      DateTime @default(now())

  trip          Trip                 @relation(fields: [tripId], references: [id], onDelete: Cascade)
  paidExpenses  Expense[]            @relation("Payer")
  expenseShares ExpenseParticipant[]
  paymentsFrom  Payment[]            @relation("PaymentFrom")
  paymentsTo    Payment[]            @relation("PaymentTo")

  @@unique([tripId, normalizedName])
  @@index([tripId])
}

model Expense {
  id             String   @id @default(cuid())
  tripId         String
  payerId        String
  description    String
  amountCents    Int
  isLateAddition Boolean  @default(false)
  createdAt      DateTime @default(now())

  trip         Trip                 @relation(fields: [tripId], references: [id], onDelete: Cascade)
  payer        Participant          @relation("Payer", fields: [payerId], references: [id])
  participants ExpenseParticipant[]

  @@index([tripId])
}

model ExpenseParticipant {
  expenseId     String
  participantId String

  expense     Expense     @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@id([expenseId, participantId])
}

model Settlement {
  id        String   @id @default(cuid())
  tripId    String
  version   Int
  status    String   @default("ACTIVE") // ACTIVE | SUPERSEDED
  createdAt DateTime @default(now())

  trip     Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  payments Payment[]

  @@unique([tripId, version])
  @@index([tripId])
}

model Payment {
  id           String    @id @default(cuid())
  settlementId String
  fromId       String
  toId         String
  amountCents  Int
  status       String    @default("PENDING") // PENDING | CONFIRMED
  confirmedAt  DateTime?
  createdAt    DateTime  @default(now())

  settlement Settlement  @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  from       Participant @relation("PaymentFrom", fields: [fromId], references: [id])
  to         Participant @relation("PaymentTo", fields: [toId], references: [id])

  @@index([settlementId])
}
```

---

## State Machine

```
DRAFT ──> VERIFIED ──> SETTLED ──> RESETTLED
  │          │                         │
  │     (add/edit                 (another late
  │      expenses)                 expense loops
  │          │                     back here)
  └──────────┘
```

Transitions:
- `POST /api/trips` → creates trip in DRAFT
- `POST /api/trips/[id]/verify` → DRAFT → VERIFIED
- `POST /api/trips/[id]/settle` → VERIFIED → SETTLED
- `POST /api/trips/[id]/resettle` → SETTLED/RESETTLED → RESETTLED

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/trips` | Create trip + Claude parse |
| GET | `/api/trips/[id]` | Full trip data |
| PATCH | `/api/trips/[id]` | Update title/currency |
| POST | `/api/trips/[id]/verify` | Lock expenses |
| POST | `/api/trips/[id]/settle` | Run algorithm |
| POST | `/api/trips/[id]/resettle` | Late expense resettlement |
| POST | `/api/trips/[id]/expenses` | Add expense |
| PUT | `/api/trips/[id]/expenses/[eid]` | Edit expense |
| DELETE | `/api/trips/[id]/expenses/[eid]` | Delete expense |
| GET | `/api/trips/[id]/settlements/latest` | Active settlement + payments |
| PATCH | `/api/trips/[id]/payments/[pid]/confirm` | Mark payment confirmed |
| PATCH | `/api/trips/[id]/participants/[pid]` | Rename participant |
| GET | `/api/share/[token]` | Public share page data |

---

## Settlement Algorithm (pseudocode)

```
function calculateSettlements(expenses, participants):
  balances = {}

  for each expense:
    share = expense.amountCents / expense.participants.length
    remainder = expense.amountCents % expense.participants.length
    balances[expense.payerId] += expense.amountCents
    for i, participant in expense.participants:
      balances[participant.id] -= share + (1 if i < remainder else 0)

  creditors = maxHeap(positive balances)
  debtors   = maxHeap(absolute negative balances)
  payments  = []

  while creditors and debtors not empty:
    creditor = creditors.pop()
    debtor   = debtors.pop()
    amount   = min(creditor.amount, debtor.amount)
    payments.push({ from: debtor.id, to: creditor.id, amountCents: amount })
    if creditor.amount > amount: creditors.push(creditor with remainder)
    if debtor.amount > amount:   debtors.push(debtor with remainder)

  return payments  // maximum N-1 payments for N participants
```

## Late Expense Resolution (pseudocode)

```
function resettle(tripId, newExpense):
  save newExpense (isLateAddition = true)
  currentSettlement = active settlement for trip
  confirmed = currentSettlement.payments where status = CONFIRMED

  allExpenses = all expenses for trip
  ideal = calculateSettlements(allExpenses)

  // Compute residual balances
  adjustedBalances = balances from ideal
  for each confirmed payment:
    adjustedBalances[payment.from] += payment.amountCents  // un-debit
    adjustedBalances[payment.to]   -= payment.amountCents  // un-credit

  newPayments = calculateSettlementsFromBalances(adjustedBalances)

  mark currentSettlement as SUPERSEDED
  create new Settlement (version + 1) with:
    - confirmed payments carried forward (status = CONFIRMED)
    - newPayments as PENDING
  update trip status = RESETTLED
```

---

## LLM Integration

**Model**: `claude-sonnet-4-5` (Sonnet-level reasoning for name normalisation)
**Method**: `tool_use` with a defined schema — forces structured JSON output

**Tool schema (key fields)**:
```typescript
{
  name: "extract_expenses",
  input_schema: {
    participants: [{ name: string, aliases: string[] }],
    expenses: [{
      payerName: string,
      description: string,
      amountCents: number,        // $45.50 → 4550
      participantNames: string[], // empty = everyone
      needsReview: boolean        // flagged ambiguous items
    }],
    title: string,
    currency: string              // ISO 4217, default "USD"
  }
}
```

**Fallbacks**:
1. No tool call → retry once with stronger prompt
2. Zod validation fail → return partial result, flag for manual correction
3. API timeout (30s) → surface error, let user retry

---

## Error Response Format

```typescript
type APIError = {
  error: string;   // human-readable
  code: string;    // e.g. "TRIP_NOT_FOUND"
  details?: unknown;
}
```

HTTP codes: 400 (validation), 404 (not found), 409 (state conflict), 422 (LLM unparseable), 500 (unexpected)

---

## Top 3 Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| LLM output unreliability | HIGH | Zod validation + `needsReview` flag + Screen 2 is the safety net |
| Late expense edge cases | MEDIUM | 15+ unit tests including overpayment reversal |
| Share link privacy | MEDIUM | nanoid(21) = 126 bits entropy; rate limit share endpoint |

---

## Build Order (Critical Path)

```
Phase 1: Scaffold + Prisma + Zod + Algorithm (TDD) ← START HERE
    ↓
Phase 2: Claude API parsing + POST /api/trips
    ↓
Phase 3: Screen 1 (paste) + Screen 2 (verify) + CRUD routes
    ↓
Phase 4: Screen 3 (settle) + Screen 4 (share) + payment routes
    ↓
Phase 5: Bonus — late expense API + UI
    ↓
Phase 6: Polish, E2E tests, README
```
