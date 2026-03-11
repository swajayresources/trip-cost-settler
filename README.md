# Trip Cost Settler 💸

A full-stack Next.js application designed to settle completely unstructured, chaotic group expenses collected from WhatsApp/iMessage threads into simple, directed peer-to-peer payments. It uses AI to extract exactly who paid for what and computes a greedy reduction algorithm to minimize the final number of transactions.

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
Navigate into the `app` folder and install:
```bash
cd app
npm install
```

Copy the template provided and rename it to `.env`:
```bash
cp .env.example .env
```
Alternatively, rename the file manually from `.env.example` to `.env`. 
Then, add your **GROQ_API_KEY**. 
Then, open the newly created `.env` file and add your **GROQ_API_KEY**. 

> [!NOTE]
> The `DATABASE_URL` is already pre-configured to point to a local SQLite file (`file:./dev.db`). You do **not** need to change this line to run the app locally.

```bash
# Get a free key at https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here
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
