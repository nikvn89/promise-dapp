# 🤝 Promise Protocol - Decentralized AI Escrow

![Promise Protocol](https://img.shields.io/badge/Powered_by-GenLayer_AI-blue?style=for-the-badge&logo=blockchain)
![React](https://img.shields.io/badge/Frontend-React_|_Vite-cyan?style=for-the-badge&logo=react)
![Tailwind](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

**Promise Protocol** is a next-generation decentralized escrow application built on **GenLayer**. It completely removes the need for human arbiters by leveraging **GenVM Semantic Consensus** to automatically verify if a promise (or task) has been fulfilled based on real-world evidence from the web.

---

## 🔗 Links
- **Live Demo:** [https://promise-dapp-mu.vercel.app/](https://promise-dapp-mu.vercel.app/)
- **GenLayer Smart Contract:** [`0x3F35265cAeB7A83831910D303f3F2937430CB6Df`](https://explorer-studio.genlayer.com/address/0x3F35265cAeB7A83831910D303f3F2937430CB6Df)

---

## ✨ Features

- **🤖 AI-Powered Arbitration:** No more biased or expensive human mediators. The GenLayer LLM acts as a strict, objective auditor to evaluate task completion.
- **🛡️ Source-Authority Security:** Smart Contracts strictly enforce trusted domains (e.g., `github.com`, `vercel.app`) to prevent evidence spoofing.
- **⚡ Immutable & Transparent:** All promises, evidence links, and AI consensus verdicts are permanently recorded on the GenLayer blockchain.
- **🎨 Glassmorphism UI:** A sleek, modern, and fully responsive user interface built with React and Tailwind CSS.

---

## 🛠️ How It Works (The Flow)

1. **Create Promise:** A user creates a promise (task) with a strict deadline and defines the trusted domains where the evidence must be hosted.
2. **Add Evidence:** Developers submit URLs (from the trusted domains) that prove the task was completed.
3. **AI Evaluation:** The `trigger_evaluation` function is called. GenLayer's network of AI nodes fetches the web evidence, evaluates it against the promise statement using Semantic Consensus, and votes on a final verdict (`FULFILLED`, `BROKEN`, or `UNVERIFIABLE`).
4. **Resolution:** If the network reaches consensus on `FULFILLED`, the escrowed funds are automatically unlocked.

---

## 💻 Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, Lucide Icons
- **Blockchain SDK:** GenLayer JS SDK (`genlayer-js`), viem
- **Smart Contract:** Python (GenVM / `genlayer.gl`)
- **Deployment:** Vercel

---

## 🚀 Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nikvn89/promise-dapp.git
   cd promise-dapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file in the root directory (if required) and add your GenLayer configuration.

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📜 Smart Contract Deployment

To run your own instance of the Promise Escrow contract:
1. Open [GenLayer Studio](https://studio.genlayer.com/).
2. Create a new Python contract file.
3. Copy the contents of `promise_escrow.py` from this repository.
4. Click **Deploy**.
5. Copy the generated Contract Address and update `CONTRACT_ADDRESS` in `src/lib/genlayer.ts`.

---

*Built with ❤️ for the GenLayer Hackathon.*
