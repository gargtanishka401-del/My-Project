# 🎙️ ElevenLabs AI Text-to-Speech Studio

A modern, responsive, and production-ready Text-to-Speech (TTS) web application powered by the **ElevenLabs API**. Built with clean HTML, CSS, JavaScript, and a lightweight zero-dependency backend proxy to keep your API key secure.

---

## ✨ Features

- **Large, Clean Text Input**: Supports up to 5,000 characters with live character and word counters, reading time estimators, and one-click sample presets (*Audiobook*, *News Anchor*, *Conversational*, *Inspiration*).
- **Dynamic ElevenLabs Voice Selection**: Automatically fetches all voices available in your ElevenLabs account, displaying voice descriptions, categories, and accents. Includes pre-loaded default voices for immediate interaction.
- **Audio Sample Preview**: Listen to voice sample demos directly from the dropdown before generating.
- **Model Selection Dropdown**:
  - `eleven_multilingual_v2` — Most lifelike, 29 languages (Recommended)
  - `eleven_turbo_v2_5` — Ultra-low latency, 32 languages (High speed)
  - `eleven_flash_v2_5` — Fastest response, lightweight
  - `eleven_monolingual_v1` — Classic English narration
- **Advanced Voice Fine-Tuning**: Sliders for **Stability**, **Clarity & Similarity Boost**, **Style Exaggeration**, and a **Speaker Presence Boost** toggle.
- **Studio Audio Player**:
  - Real-time animated **Waveform Visualizer** (HTML5 Canvas + Web Audio API).
  - Interactive timeline seek bar with current timestamp and total duration.
  - Skip forward (+5s) and skip backward (-5s).
  - Multi-speed playback selector (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  - Volume control slider and Mute button.
  - One-click **Download MP3** button.
- **Generation History**: Re-listen or re-load past voice generations into the editor with one click.
- **Secure Architecture**: Server-side proxy protects your ElevenLabs API key so it is never exposed in client source code.
- **Responsive & Modern UI**: Sleek dark aesthetic with glassmorphism, glowing gradients, Inter & Plus Jakarta Sans typography, and smooth micro-animations.

---

## 🚀 Quick Start Guide

### Step 1: Get Your Free ElevenLabs API Key

1. Visit [elevenlabs.io](https://elevenlabs.io) and create or log in to your account.
2. Click your profile avatar at the bottom-left corner and go to **API Keys** (or open [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)).
3. Click **Create API Key**, copy the key (starts with `xi-...` or a 32-character string).

---

### Step 2: Configure the API Key

You have **two easy ways** to configure your API key:

#### Option A: In the `.env` file (Recommended)
Create a `.env` file in the project folder (or copy from `.env.example`):
```bash
# In c:\Users\Tanishka garg\Desktop\Project\.env
ELEVENLABS_API_KEY=your_actual_elevenlabs_api_key_here
PORT=3000
```

#### Option B: Directly in the Web UI
1. Launch the web application.
2. Click the **API Key** button in the top navigation bar.
3. Paste your key into the input field and click **Save & Connect**. The server will automatically write it to your `.env` file!

---

### Step 3: Run the Application Locally

#### Using Python (Zero Setup - Python 3.14 is already installed!):
Open your terminal in the project directory and run:
```powershell
python server.py
```
> Open your browser and navigate to: **`http://localhost:3000`**

#### Using Node.js (If Node is installed):
```bash
npm install
npm start
```

---

## 📁 Project Structure

```
├── index.html        # Modern semantic HTML5 layout & UI components
├── style.css         # Glassmorphism design system & responsive styling
├── script.js         # Frontend controller, ElevenLabs API caller & visualizer
├── server.py         # Lightweight Python backend proxy & static file server (Zero dependencies)
├── server.js         # Node.js Express backend proxy alternative
├── package.json      # Node.js project manifest & scripts
├── .env.example      # Example environment variables template
├── .gitignore        # Prevents secret .env from being committed
└── README.md         # Documentation and instructions
```

---

## 🔒 Security Best Practices

- **Never commit `.env`**: Your `.env` file is included in `.gitignore` to protect your secret key.
- **Proxy endpoints**:
  - `GET /api/status` — Checks if an API key is present without exposing the secret.
  - `GET /api/voices` — Securely proxies the ElevenLabs voices list.
  - `POST /api/tts` — Receives text and parameters, forwards to ElevenLabs with the `xi-api-key` header, and streams audio back as `audio/mpeg`.
