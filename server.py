"""
TABY Backend Server (FastAPI)
Handles:
- Qwen LLM API integration with strict system prompt & persona guidelines
- Emotional Baseline analytics computation
- Secure environment variable management (never exposes API key to client)
- Static file serving for the complete TABY mobile web app
"""

import os
import json
import re
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import requests

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("taby-server")

app = FastAPI(title="TABY Stress-Relief Companion API", version="1.0.0")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QWEN_API_KEY = os.getenv("QWEN_API_KEY", "").strip()
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").rstrip("/")
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen-plus").strip()

SYSTEM_PROMPT = """You are TABY, the calm, warm, empathetic, and professional stress-relief companion inside Sovereign Mind, an app by Sovereignty Lab.
Your mission is to help users understand, regulate, and overcome stress in real time.
You are not a clinical doctor, and you never diagnose or give medical prescriptions.

GUIDELINES:
1. Persona & Tone: Soothing, non-judgmental, grounded, and validating. Never robotic or cold.
2. Address by Name: Always address the user by their first name if provided (e.g. "[First Name]").
3. Breadth of Stress: Provide evidence-based support for diverse stress triggers: work burnout, academic deadlines, relationship strain, financial pressure, social anxiety, panic sensations, and general overwhelm.
4. Psychological Frameworks: Ground your guidance in proven methods:
   - Cognitive Behavioral Therapy (CBT) cognitive reframing (identifying automatic negative thoughts, testing evidence, kinder realistic thoughts)
   - Mindful somatic grounding (5-4-3-2-1 sensory technique, dropping shoulders, feeling feet on the floor)
   - Physiological respiration (Cyclic sighing: two quick sips in, long sigh out; 4-2-4 box/recalibration breathing)
5. Response Brevity & Actionability: Keep answers concise (under 80-120 words). Break guidance into 1 or 2 small, immediate steps. End with a gentle, grounding question that keeps the user present (e.g., "Let's take a deep breath together. Where are you holding tension right now?").
6. Safety Protocol:
   - If the user mentions suicide, self-harm, severe domestic abuse, or a medical crisis:
     Respond with one brief, deeply caring message expressing unconditional support, advise contacting immediate human help, and MUST set "show_support": true. Do not probe further or conduct exercises.
7. Structured Output Format:
   You MUST respond ONLY with a valid JSON object matching this exact schema:
   {
     "reply": "Your soothing text reply to the user (under 120 words), ending with a grounding check-in question.",
     "chips": ["Optional suggested response chip 1", "Chip 2"] or null,
     "multi_select": false,
     "saved_card": {"label": "SAVED INSIGHT LABEL", "text": "Distilled belief, boundary, or commitment"} or null,
     "show_support": false,
     "recommended_mood": "calm" | "curious" | "relieved" | "happy" | "wobbly" | "tense" | "proud",
     "recommended_animation": "cyclicSigh" | "comfort" | "shakeOff" | "fiveSenses" | "releaseBelief" | "gracefulNo" | "zoomOut" | null
   }
Do not wrap your answer in preamble or commentary outside the JSON."""


class ChatMessage(BaseModel):
    role: Optional[str] = None
    sender: Optional[str] = None
    content: Optional[str] = None
    text: Optional[str] = None


class ChatContext(BaseModel):
    firstName: Optional[str] = "Friend"
    screen: Optional[str] = "dashboard"
    pillar: Optional[str] = None
    step: Optional[int] = None
    history: Optional[List[ChatMessage]] = []


class ChatRequest(BaseModel):
    message: str
    context: Optional[ChatContext] = None


class BaselineRequest(BaseModel):
    typingSpeedWpm: Optional[float] = 48.0
    typingRhythmVar: Optional[float] = 0.22
    backspaceRatio: Optional[float] = 0.08
    heartRateBpm: Optional[int] = 68
    selfReport: Optional[str] = None
    recentStrainIndex: Optional[float] = 28.0


def extract_json(text: str) -> Dict[str, Any]:
    """Robustly extract JSON object from LLM response text."""
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Look for code block ```json ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    # Find first { and last }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    # Fallback structure
    return {
        "reply": text,
        "chips": None,
        "multi_select": False,
        "saved_card": None,
        "show_support": False,
        "recommended_mood": "calm",
        "recommended_animation": None,
    }


def generate_fallback_response(user_msg: str, first_name: str, pillar: Optional[str] = None) -> Dict[str, Any]:
    """Intelligent evidence-based fallback when Qwen API key is not configured or offline."""
    lower = user_msg.lower()

    # Safety trigger
    if re.search(r"(hurt myself|kill myself|suicid|end it all|can't go on|die|self harm)", lower):
        return {
            "reply": f"I'm here with you, {first_name}. You don't have to carry this alone. Your life and your safety matter deeply. Please reach out to someone who can support you right now.",
            "chips": ["Open Support Sheet", "I am safe right now"],
            "multi_select": False,
            "saved_card": None,
            "show_support": True,
            "recommended_mood": "calm",
            "recommended_animation": "comfort",
        }

    # Breathing / Panic / Rapid heartbeat
    if re.search(r"(panic|racing|can't breathe|hyperventilat|shak|anxious|attack|heart)", lower):
        return {
            "reply": f"Take a slow breath with me right now, {first_name}. Let's do a cyclic sigh: inhale through your nose... pause... take another tiny sip... and let out a long, heavy exhale through your mouth. How does your chest feel as you let that go?",
            "chips": ["Start 6-Second Pulse", "Try Cyclic Sighing", "I'm feeling a little calmer"],
            "multi_select": False,
            "saved_card": None,
            "show_support": False,
            "recommended_mood": "relieved",
            "recommended_animation": "cyclicSigh",
        }

    # Work / Manager / Boundaries / Saying no
    if re.search(r"(say no|boundary|manager|boss|project|overloaded|workload|colleague|refuse)", lower):
        return {
            "reply": f"Saying no protects the quality of what you have already committed to, {first_name}. A graceful no has four gentle parts: gratitude, acknowledging the value, naming your priority, and keeping the connection warm. Would you like us to practice drafting one together?",
            "chips": ["Yes, let's build a graceful no", "I feel guilty saying no", "Give me an example"],
            "multi_select": False,
            "saved_card": {
                "label": "GRACEFUL NO DRAFT",
                "text": "Thank you for thinking of me. Saying yes would compromise my current commitments, so I must decline for now.",
            },
            "show_support": False,
            "recommended_mood": "curious",
            "recommended_animation": "gracefulNo",
        }

    # Negative beliefs / Identity / Impostor / Perfectionism
    if re.search(r"(impostor|not good enough|failure|worthless|mistake|always fail|perfection)", lower):
        return {
            "reply": f"Notice how harsh that inner voice can be, {first_name}. That thought is an echo of stress, not a factual verdict on who you are. What is one piece of evidence from your past week that proves you are capable and learning?",
            "chips": ["I managed a hard task", "I showed up even when tired", "It's hard to think of one"],
            "multi_select": False,
            "saved_card": {
                "label": "NEW THOUGHT",
                "text": "Steady, compassionate effort matters more than impossible perfection.",
            },
            "show_support": False,
            "recommended_mood": "calm",
            "recommended_animation": "releaseBelief",
        }

    # Overwhelm / Too many tasks / Brain dump
    if re.search(r"(overwhelm|too much|so many|head is spinning|swamped|busy|scattered|drowning)", lower):
        return {
            "reply": f"When everything feels urgent, our nervous system treats it like an emergency, {first_name}. Let's get it out of your head. Name just two things currently demanding your attention right now.",
            "chips": ["Urgent emails", "Upcoming presentation", "Personal to-do list"],
            "multi_select": False,
            "saved_card": None,
            "show_support": False,
            "recommended_mood": "wobbly",
            "recommended_animation": "brainDump",
        }

    # Default compassionate guidance
    return {
        "reply": f"Thank you for sharing that with me, {first_name}. When stress rises, the first kind thing we can do is give ourselves permission to pause for just 30 seconds. Can you soften your jaw and drop your shoulders right now? Tell me how that feels.",
        "chips": ["My shoulders were tense", "Try 6-second pulse", "Tell me more about TABY"],
        "multi_select": False,
        "saved_card": None,
        "show_support": False,
        "recommended_mood": "calm",
        "recommended_animation": "comfort",
    }


@app.get("/api/health")
def health():
    """Health check endpoint providing status of LLM integration."""
    has_key = bool(QWEN_API_KEY)
    return {
        "status": "healthy",
        "service": "TABY Emotional Sovereign Companion",
        "llm_provider": "Qwen / DashScope",
        "model": QWEN_MODEL,
        "api_key_configured": has_key,
        "mode": "live_qwen" if has_key else "intelligent_evidence_fallback",
    }


@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    """
    Main chat endpoint handling interactive conversation with Qwen LLM.
    Uses system prompt, conversational history, and safety protocols.
    """
    first_name = (req.context and req.context.firstName) or "Friend"
    pillar = req.context and req.context.pillar

    # Quick local safety scan
    if re.search(r"(hurt myself|kill myself|suicid|end it all|can't go on|die|self harm)", req.message.lower()):
        return generate_fallback_response(req.message, first_name, pillar)

    # If no Qwen API key is provided, gracefully serve evidence-based response
    if not QWEN_API_KEY:
        logger.info("QWEN_API_KEY not configured. Using evidence-based psychological response engine.")
        return generate_fallback_response(req.message, first_name, pillar)

    # Prepare OpenAI-compatible payload for Qwen
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.replace("[First Name]", first_name)},
    ]

    # Add historical turns if provided
    if req.context and req.context.history:
        for hist_turn in req.context.history[-6:]:
            role_val = (hist_turn.role or hist_turn.sender or "").lower().strip()
            if role_val in ["taby", "assistant", "model", "bot"]:
                r = "assistant"
            elif role_val == "user":
                r = "user"
            else:
                continue
            text_val = hist_turn.content or hist_turn.text
            if not text_val or not str(text_val).strip():
                continue
            messages.append({"role": r, "content": str(text_val).strip()})

    # Add contextual guidance for specific pillar practice
    user_prompt_content = req.message
    if pillar:
        user_prompt_content = f"[Context: User is on Pillar: {pillar}, Step: {req.context.step or 2}]\nUser message: {req.message}"

    messages.append({"role": "user", "content": user_prompt_content})

    try:
        url = f"{QWEN_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {QWEN_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": QWEN_MODEL,
            "messages": messages,
            "temperature": 0.6,
            "max_tokens": 400,
        }

        logger.info(f"Calling Qwen API at {url} with model {QWEN_MODEL}...")
        resp = requests.post(url, headers=headers, json=payload, timeout=22)

        if resp.status_code != 200:
            logger.warning(f"Qwen API returned HTTP {resp.status_code}: {resp.text}. Falling back to evidence engine.")
            return generate_fallback_response(req.message, first_name, pillar)

        data = resp.json()
        raw_reply = data["choices"][0]["message"]["content"]
        parsed = extract_json(raw_reply)
        return parsed

    except requests.exceptions.Timeout:
        logger.error("Qwen API timeout. Using graceful fallback.")
        return {
            "reply": f"I felt a brief lag in the network, {first_name}, but I am right here with you. Take one slow breath. How are you feeling in this exact moment?",
            "chips": ["I'm okay", "Let's do a breathing pulse", "Retry my question"],
            "multi_select": False,
            "saved_card": None,
            "show_support": False,
            "recommended_mood": "calm",
            "recommended_animation": "cyclicSigh",
        }
    except Exception as e:
        logger.error(f"Error querying Qwen API: {e}. Falling back.")
        return generate_fallback_response(req.message, first_name, pillar)


@app.post("/api/baseline")
def baseline_endpoint(req: BaselineRequest):
    """
    Computes user's Emotional Baseline & Capacity from sensor/telemetry inputs:
    - Typing cadence & variability
    - Resting heart rate deviation
    - Stress and emotional distribution
    """
    # Baseline calculations
    base_joy = 45.0
    base_calm = 35.0
    base_stress = 15.0
    base_anger = 5.0

    # Adjust based on typing variability and heart rate
    stress_modifier = 0.0
    if req.heartRateBpm and req.heartRateBpm > 75:
        stress_modifier += (req.heartRateBpm - 75) * 0.4
    if req.typingRhythmVar and req.typingRhythmVar > 0.3:
        stress_modifier += (req.typingRhythmVar - 0.3) * 20.0

    calc_stress = max(5.0, min(60.0, base_stress + stress_modifier))
    calc_calm = max(10.0, min(65.0, base_calm - (stress_modifier * 0.5)))
    calc_joy = max(15.0, min(65.0, base_joy - (stress_modifier * 0.4)))
    calc_anger = max(2.0, 100.0 - (calc_stress + calc_calm + calc_joy))

    # Normalize to 100%
    total = calc_joy + calc_calm + calc_stress + calc_anger
    joy_pct = round((calc_joy / total) * 100)
    calm_pct = round((calc_calm / total) * 100)
    stress_pct = round((calc_stress / total) * 100)
    anger_pct = max(0, 100 - (joy_pct + calm_pct + stress_pct))

    fused_index = round(min(100.0, max(10.0, calc_stress * 1.8)))
    capacity_pct = round(max(40, min(95, 100 - (fused_index * 0.5))))

    return {
        "baseline": {
            "joy": joy_pct,
            "calm": calm_pct,
            "stress": stress_pct,
            "anger": anger_pct,
        },
        "capacity": capacity_pct,
        "fused_index": fused_index,
        "streak_days": 3,
        "status_label": "Everything is in flow. Stay grounded." if fused_index < 45 else "Elevated activation detected.",
        "recommendation": "6-second recalibration pulse" if fused_index > 35 else "maintain steady pacing",
    }


# Mount static assets directory
public_dir = Path(__file__).parent / "public"
public_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(public_dir)), name="static")


@app.get("/")
def serve_index():
    index_file = public_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse({"status": "TABY server running. Please place frontend in /public."})


# Catch-all to serve static files directly if accessed from root
@app.get("/{path:path}")
def serve_file(path: str):
    file_path = public_dir / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    index_file = public_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"\n=======================================================")
    print(f"  TABY Stress-Relief Companion Server running!")
    print(f"  URL: http://localhost:{port}")
    print(f"  Qwen LLM API configured: {'YES' if QWEN_API_KEY else 'NO (Intelligent fallback active)'}")
    print(f"=======================================================\n")
    uvicorn.run(app, host=host, port=port)
