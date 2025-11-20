# Siamese AI Grader 🐱

**Siamese AI Grader** is a powerful, client-side React application that uses **Google Gemini** and **Alibaba Qwen-VL** models to grade handwritten AP Free Response Questions (FRQs). It features a "No-Backend" architecture, running entirely in the browser for maximum privacy and speed.

---

## ✨ Features

*   **Dual-Engine AI**: Switch between **Google Gemini 3.0 Pro** (Best Reasoning) and **Alibaba Qwen-VL Max** (Vision capabilities) dynamically.
*   **Privacy First**: No backend server required. Files are processed locally in the browser and sent directly to the AI provider APIs.
*   **Multimodal Grading**:
    *   Supports **Images** (JPG, PNG, WEBP).
    *   Supports **HEIC** (iPhone photos).
    *   Supports **PDF** documents (automatically converted to images for processing).
*   **Smart Compression**: Automatically resizes and compresses large files to bypass API payload limits (RPC Error mitigation).
*   **Detailed Feedback**: Provides formatted scoring tables with "Rubric Match", "Student Evidence", and "Reasoning".

---

## 🛠️ Tech Stack

*   **Core**: React 19, TypeScript
*   **AI SDK**: Google GenAI Web SDK (`@google/genai`)
*   **PDF Processing**: PDF.js (via CDN)
*   **Architecture**: Pure ESM (ES Modules), No-Build capable (via Import Maps)

---

## 🚀 Getting Started (Local Development)

Since this project uses `process.env.API_KEY`, you need to configure it for local use.

### Option A: Quick Start (The "Replace Key" Method)

If you just want to download and run the code immediately without setting up a build tool:

1.  **Clone/Download** the repository.
2.  Open `App.tsx`.
3.  Find the line: `apiKey: process.env.API_KEY` inside `handleGrade` (specifically `gradeWithGemini`).
4.  **Replace** `process.env.API_KEY` with your actual Google Gemini API Key string (e.g., `"AIzaSy..."`).
5.  Serve the folder using a local server.
    *   If you have Python: `python3 -m http.server`
    *   If you have VS Code: Use the "Live Server" extension.
6.  Open `http://localhost:8000` (or the port shown).

### Option B: Robust Setup (Using Vite - Recommended)

For a proper development environment:

1.  Initialize a Vite project: `npm create vite@latest siamese-grader -- --template react-ts`
2.  Copy the `App.tsx`, `types.ts`, and `index.css` files into `src/`.
3.  Install dependencies:
    ```bash
    npm install @google/genai pdfjs-dist
    ```
4.  Create a `.env` file in the root:
    ```
    VITE_API_KEY=your_google_api_key_here
    ```
5.  Update `App.tsx` to use `import.meta.env.VITE_API_KEY` instead of `process.env.API_KEY`.
6.  Run `npm run dev`.

---

## 🌐 Deployment Tutorial

You can deploy this app for free on platforms like **Vercel** or **Netlify**.

### Prerequisite: Prepare your Code
Since the provided code uses `process.env.API_KEY`, most cloud builders (like Vercel) using Vite/Create-React-App will expect an Environment Variable.

1.  Ensure you have a `package.json` and build setup (e.g., created via Vite as shown in Option B above).
2.  Push your code to a **GitHub Repository**.

### Deploying to Vercel

1.  Log in to [Vercel](https://vercel.com/).
2.  Click **"Add New..."** -> **"Project"**.
3.  Select your **Siamese AI Grader** repository from GitHub.
4.  **Configure Project**:
    *   **Framework Preset**: Vite (or Create React App depending on your setup).
    *   **Root Directory**: `./` (usually default).
5.  **Environment Variables** (Crucial Step):
    *   Expand the "Environment Variables" section.
    *   Key: `VITE_API_KEY` (if using Vite) or `REACT_APP_API_KEY` (if using CRA).
    *   Value: Your Google Gemini API Key.
6.  Click **Deploy**.

### Deploying as a Static Site (GitHub Pages)

If you followed **Option A (Quick Start)** and replaced the API key in the code:

1.  Go to your GitHub Repository settings.
2.  Navigate to **Pages**.
3.  Set the "Source" to your `main` branch (or `/docs` folder if you put files there).
4.  Save. Your site will be live in minutes.
    *   *Note: Exposing your API Key in public code is not recommended. Restrict your API Key usage in Google AI Studio settings.*

---

## 🔑 API Key Configuration

### 1. Google Gemini API Key (Required)
*   Get it here: [Google AI Studio](https://aistudio.google.com/)
*   This key is used for the primary logic and handwriting recognition.
*   **Setup**: Needs to be injected via build environment or hardcoded (see Getting Started).

### 2. Alibaba DashScope API Key (Optional)
*   Get it here: [Aliyun DashScope Console](https://dashscope.console.aliyun.com/)
*   Required only if you want to use **Qwen-VL** models.
*   **Setup**: Users enter this key directly in the App UI (top right corner). It is stored securely in your browser's `Local Storage`.

---

## 📝 License

This project is open source. Feel free to fork and modify!
