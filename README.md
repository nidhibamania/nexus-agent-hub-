# 🌌 Nexus AI: Universal Agent Hub

**Nexus AI** is a sophisticated, multi-agent AI ecosystem built for the **Gen AI APAC Academy Hackathon**. It leverages the power of **Google Gemini 3 Flash** to provide a seamless, specialized, and high-performance AI experience.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://ais-pre-hz54x4rtrgmnvw7bvav4wx-314786716151.asia-east1.run.app)
[![Built with Gemini](https://img.shields.io/badge/Built%20with-Gemini-blue)](https://ai.google.dev/)
[![Hackathon](https://img.shields.io/badge/Hackathon-GenAI%20APAC%20Academy-orange)](https://hack2skill.com/)

---

## 🚀 Overview

Nexus AI isn't just another chatbot. It's a **Universal Agent Hub** that allows users to switch between specialized AI personas, each optimized for specific tasks. Whether you're deep-diving into research, crafting creative narratives, or architecting complex systems, Nexus AI provides the right intelligence for the job.

### 🤖 The Nexus Agents
- **🔍 The Researcher:** Optimized for deep analysis, data synthesis, and objective reporting.
- **🎨 The Creative:** A master of storytelling, brainstorming, and artistic expression.
- **🏗️ The Architect:** Specialized in technical design, coding logic, and system structures.

---

## ✨ Key Features

- **Multi-Agent Architecture:** Seamlessly switch between specialized AI models without losing context.
- **Gemini 3 Flash Integration:** Powered by Google's latest high-speed, high-reasoning model.
- **Persistent Chat History:** Each agent maintains its own conversation context for coherent long-term interactions.
- **Premium UI/UX:** Built with a modern "Dark Nexus" aesthetic using Tailwind CSS and smooth animations via Framer Motion.
- **Responsive Design:** Fully optimized for desktop and mobile experiences.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion (motion/react)
- **Icons:** Lucide React
- **AI Engine:** Google Generative AI SDK (`@google/genai`)
- **Model:** `gemini-3-flash-preview`

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- A Gemini API Key (Get one at [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nidhibamania/nexus-agent-hub-.git
   cd nexus-agent-hub-
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy the `.env.example` file to a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
   Then, open `.env` and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

---

## 🏆 Hackathon Submission

This project was developed for **Track 1: Build and Deploy AI Agents** of the **Gen AI APAC Academy**.

- **App Name:** Nexus AI: Universal Agent Hub
- **Deployment:** Hosted on Google Cloud Run via AI Studio.
- **Objective:** To demonstrate the versatility of Gemini 3 Flash in a multi-persona environment.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Built with ❤️ for the Gen AI APAC Academy Hackathon.*
