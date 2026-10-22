# TABY · Real-Time Early Active Stress Prevention Companion

> A web application designed to help users understand, regulate, and overcome stress in real time with an interactive amorphous blob companion (**TABY**), backed by the **Qwen LLM** and psychological grounding frameworks (CBT reframing, cyclic sighing, somatic grounding).

---

## 🌟 Key Features

1. **Amorphous Living Agent (TABY)**:
   - Drawn on a zero-dependency HTML5 `<canvas>` using a 72-point cubic/quadratic Bézier spline.
   - Dynamic spring physics for tactile squash/poke reactions and hop animations.
   - Ambient gaze wandering and pointer-tracking eye movements.
   - Expression morphing (`calm`, `happy`, `listen`, `worried`, `sleep`, `proud`).
   - Guided physiological respiration animation (expanding on inhale, holding, contracting on exhale).

2. **Visual Feedback Connected to Qwen**:
   - **Typing feedback**: Blob senses keystroke timing (`TabySense`) and turns curiously towards the input.
   - **Thinking feedback**: When Qwen is formulating a response, TABY enters an animated listening/thinking state with subtle glowing and tilting.
   - **Delivery feedback**: When the response arrives, TABY smoothly transitions to a soothing/relieved state with a nod or hop.

3. **Complete 9-Screen Workflow (Sovereignty Lab Specification)**:
   - **Screen 1 (Demographics & Auth)**: First name, email validation, single-select gender and age chips.
   - **Screen 2 (Data Sovereignty Terms)**: In-card scrollable privacy pledge, typing and voice telemetry toggles.
   - **Screen 3 (Define Biometrics)**: Synced sensor toggles with "Coming soon" hints for future sensors.
   - **Screen 4 (Master Emotional Command Dashboard)**: 82% circular SVG capacity ring gauge, `Connect`, `Regulate`, and `Purpose` pop-ups, proactive TABY card with 6-second pulse trigger, and live TABY companion.
   - **Screen 5 (TABY Interactive Chat)**: Full-screen conversation with Qwen, system cards, interactive action chips, voice-to-text mic button, and crisis safety protocol.
   - **Screen 6 (Emotional Insights)**: Interactive SVG donut chart (Joy 45%, Calm 35%, Stress 15%, Anger 5%), 3-day balance streak, simulated biometric data-reading sheet with live pulse meter.
   - **Screen 7 (Historical Fusion Analytics)**: 24h / 7d multi-line interactive graph with typing speed, voice stress, fused index, and clickable JITAI `[D]` intervention detail sheets.
   - **Screen 8 (TABY Library)**: Specialized modules (Parasympathetic Co-regulation, Agitated Overload, Off-Peak Skill Building) and the 6 Core Pillars with progress rings.
   - **Pillar Workflow**: 3-step structured guidance (Step 1: Learn with theory -> Step 2: Practice with TABY chat and role-play -> Step 3: Reflect with private journal -> Completion celebration).
   - **Screen 9 (Profile & Sovereignty)**: Identity card, Edit Profile sheet, Pro Tier plan details, Dark/Light mode toggle, and 1-click Delete All My Data.
   - **Reusable Breathing Overlay**: 6-second Recalibration Pulse and 60-second Breathing Exercise with stress reduction metrics (`-18%` / `-22%`).

4. **Security & Privacy**:
   - Qwen API key is kept securely on the backend server and never exposed to the frontend.
   - Full offline fallback mode: If no API key is provided, an evidence-based CBT/mindfulness engine powers all responses automatically.

---

## 🚀 Quick Start

### Option A: Running with Python / FastAPI (Recommended)

Python 3.10+ and `uv` or `pip` are supported:

```bash
# 1. Run using uv (Fast and automatic dependency resolution)
uv run python server.py

# Or using standard pip:
pip install -r requirements.txt
python server.py
```

The app will be live at:
👉 **http://localhost:8000**

---

### Option B: Running with Node.js / Express

```bash
# 1. Install dependencies
npm install

# 2. Start the Express server
npm start
```

The app will be live at:
👉 **http://localhost:8000**

---

## 🔑 Configuring Qwen LLM API

Create or edit your `.env` file in the project root:

```env
# Alibaba Cloud DashScope / Qwen API Key
QWEN_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Base URL (International or China mainland)
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Preferred Qwen model (qwen-plus, qwen-turbo, qwen-max, or qwen2.5-72b-instruct)
QWEN_MODEL=qwen-plus

# Server port
PORT=8000
HOST=0.0.0.0
```

> **Note**: If `QWEN_API_KEY` is left blank, TABY will automatically operate in **intelligent evidence-based mode**, delivering psychological grounding responses, chips, and safe crisis protocols without failing.

---

## 📁 Project Architecture

```
TABY muckup/
├── .env.example            # Environment variables template
├── .env                    # Active local environment settings
├── requirements.txt        # Python backend dependencies
├── package.json            # Node.js manifest and scripts
├── server.py               # FastAPI backend (Qwen proxy, baseline math, static files)
├── server.js               # Express.js backend alternative
├── public/                 # Production frontend assets
│   ├── index.html          # Semantic HTML5 app with 390x844px phone frame
│   ├── css/
│   │   └── taby.css        # Calming design system, colors, glassmorphism, animations
│   └── js/
│       ├── taby-blob.js    # Living mathematical blob & spring physics engine
│       ├── state.js        # LocalStorage state persistence (pillars, profile, history)
│       ├── qwen-client.js  # Qwen API client with blob thinking/calming hooks
│       ├── ui-popups.js    # Breathing overlay, Support sheet, sheets, and toasts
│       └── app.js          # Navigation router across all 9 screens & pillar flows
└── README.md               # Documentation
```

---

## 🎨 Color Palette Reference

- **Background**: `#0B0F14`
- **Surface Panel**: `#12181F`
- **Card Surface**: `#1A222B`
- **Text Primary**: `#EAF0F5`
- **Muted Text**: `#8A99A8`
- **Signature Teal**: `#4AC9C0`
- **Amber (Purpose / Caution)**: `#F2A65A`
- **Sage (Regulate / Calm)**: `#7FD9A8`
- **Orchid (Connect / Emotions)**: `#B36FC3`
- **Indigo (Identity)**: `#6E8CF0`
- **Lime (Clarity)**: `#CBE870`
- **Border**: `#2A3642`
