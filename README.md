# Trip Cost Settler 💸

A full-stack Next.js application designed to settle completely unstructured, chaotic group expenses collected from WhatsApp/iMessage threads into simple, directed peer-to-peer payments. It uses AI to extract exactly who paid for what and computes a greedy reduction algorithm to minimize the final number of transactions.

## ✨ Core Features & Philosophy

*   **Parsing (Agentic Extraction):** No pre-formatted templates required. Organizers paste raw paragraph text containing slang, abbreviations, and informal currencies. The backend orchestrates either Anthropic `claude-haiku-4-5` or Groq `llama-3.3-70b-versatile` endpoints using defined Tool Calling schemas to pull clean JSON instances of Payers, Participants, and Cents.
*   **Verification (Human-in-the-Loop):** AI isn't infallible. The extracted breakdown bridges into an interactive verification dashboard where the Organizer (the ultimate source of truth) can adjust splits, correct name typos, or add missing charges dynamically before the math begins.
*   **Settlement Engine:** Under the hood, the app calculates specific net balances per person and computes an automated path to make everyone square (`Person A ➔ pays ➔ Person B $120.00`). Total payments needed are algorithmically reduced to the absolute mathematical minimum. 
*   **Decentralized Coordination:** The app provides a read-only tokenized link where anyone in the party can view the Action Plan and manually mark their specific debt as "Confirmed" when they've paid. A circular progress indicator tracks the percentage of complete settlement.
*   **The Bonus Challenge (Late Expenditures):** Real life is messy. Users might suddenly remember a $120 gas receipt after the group has already begun making payments. Our backend generates immutable revision "branches": already-completed payments stay frozen in the database so money doesn't mysteriously reroute after changing hands, while the remainder of the pending transactions are instantly mapped and recalculated across pending peers.

## 🛠️ Stack Choices

*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Database:** Prisma (with SQLite for local portability)
*   **Styling & UI:** Tailwind CSS, Framer Motion (for smooth layout rendering and spring transitions), Lucide React (Icons), Sonner (Toasts). We strictly adhered to a "Premium Dark Theme / Glassmorphism" system to maintain an elegant user aesthetic. 
*   **LLMs SDKs:** Direct SDK integrations for both Anthropic (`@anthropic-ai/sdk`) and Groq (`groq-sdk`).

## 🚀 Getting Started

To run this application locally, ensure you have **Node.js >= 20.9.0** installed. 

### 1. Clone the repository
```bash
git clone https://github.com/swajayresources/trip-cost-settler.git
cd trip-cost-settler
```

### 2. Install dependencies
CD into the `app` folder where the Next.js project lives and install.
```bash
cd app
npm install
```

### 3. Environment Variables
To operate the AI Parsing Engine and the Database, you will need to set up your environment variables. 

Copy the template provided:
```bash
cp .env.example .env
```
Then, open the newly created `.env` file and add your Groq or Anthropic API key. The `DATABASE_URL` is pre-configured for a local SQLite database.

```bash
# Get a free key at https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here

# (Optional) Get a key at https://console.anthropic.com
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 4. Initialize the Database
This project uses Prisma with a local SQLite database for effortless onboarding without Docker.
```bash
npx prisma db push
npx prisma generate
```

### 5. Run the App
Launch the Next.js development server:
```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

---
*Created as part of the Revelstreet Engineering Take-Home Scenario.*
