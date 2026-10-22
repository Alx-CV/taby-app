/**
 * TABY Backend Server (Node.js / Express)
 * Provides:
 * - /api/chat: Secure proxy to Qwen LLM API (Alibaba DashScope) with persona, CBT/mindfulness prompts & fallback
 * - /api/baseline: Computation of emotional baseline metrics from user telemetry
 * - /api/health: Service status
 * - Static file serving for the full web app
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;
const QWEN_API_KEY = (process.env.QWEN_API_KEY || '').trim();
const QWEN_BASE_URL = (process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const QWEN_MODEL = (process.env.QWEN_MODEL || 'qwen-plus').trim();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are TABY, the calm, warm, empathetic, and professional stress-relief companion inside Sovereign Mind, an app by Sovereignty Lab.
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
5. Response Brevity & Actionability: Keep answers concise (under 80-120 words). Break guidance into 1 or 2 small, immediate steps. End with a gentle, grounding question that keeps the user present.
6. Safety Protocol:
   - If the user mentions suicide, self-harm, severe domestic abuse, or a medical crisis:
     Respond with one brief, deeply caring message expressing unconditional support, advise contacting immediate human help, and MUST set "show_support": true.
7. Structured Output Format:
   Respond ONLY with valid JSON matching:
   {
     "reply": "Your soothing text reply (under 120 words), ending with a grounding check-in question.",
     "chips": ["Optional suggested response chip 1", "Chip 2"] or null,
     "multi_select": false,
     "saved_card": {"label": "SAVED INSIGHT LABEL", "text": "Distilled belief, boundary, or commitment"} or null,
     "show_support": false,
     "recommended_mood": "calm" | "curious" | "relieved" | "happy" | "wobbly" | "tense" | "proud",
     "recommended_animation": "cyclicSigh" | "comfort" | "shakeOff" | "fiveSenses" | "releaseBelief" | "gracefulNo" | "zoomOut" | null
   }`;

function extractJson(text) {
  text = (text || '').trim();
  try { return JSON.parse(text); } catch (e) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch (e) {}
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch (e) {}
  }

  return {
    reply: text,
    chips: null,
    multi_select: false,
    saved_card: null,
    show_support: false,
    recommended_mood: 'calm',
    recommended_animation: null
  };
}

function getFallbackResponse(userMsg, firstName) {
  const lower = (userMsg || '').toLowerCase();

  // Safety trigger
  if (/(hurt myself|kill myself|suicid|end it all|can't go on|die|self harm)/i.test(lower)) {
    return {
      reply: `I'm here with you, ${firstName}. You don't have to carry this alone. Your life and your safety matter deeply. Please reach out to someone who can support you right now.`,
      chips: ["Open Support Sheet", "I am safe right now"],
      multi_select: false,
      saved_card: null,
      show_support: true,
      recommended_mood: "calm",
      recommended_animation: "comfort"
    };
  }

  // Panic / Breathing
  if (/(panic|racing|can't breathe|hyperventilat|shak|anxious|attack|heart)/i.test(lower)) {
    return {
      reply: `Take a slow breath with me right now, ${firstName}. Let's do a cyclic sigh: inhale through your nose... pause... take another tiny sip... and let out a long, heavy exhale through your mouth. How does your chest feel as you let that go?`,
      chips: ["Start 6-Second Pulse", "Try Cyclic Sighing", "I'm feeling a little calmer"],
      multi_select: false,
      saved_card: null,
      show_support: false,
      recommended_mood: "relieved",
      recommended_animation: "cyclicSigh"
    };
  }

  // Boundaries / Work
  if (/(say no|boundary|manager|boss|project|overloaded|workload|colleague|refuse)/i.test(lower)) {
    return {
      reply: `Saying no protects the quality of what you have already committed to, ${firstName}. A graceful no has four gentle parts: gratitude, acknowledging the value, naming your priority, and keeping the connection warm. Would you like us to practice drafting one together?`,
      chips: ["Yes, let's build a graceful no", "I feel guilty saying no", "Give me an example"],
      multi_select: false,
      saved_card: {
        label: "GRACEFUL NO DRAFT",
        text: "Thank you for thinking of me. Saying yes would compromise my current commitments, so I must decline for now."
      },
      show_support: false,
      recommended_mood: "curious",
      recommended_animation: "gracefulNo"
    };
  }

  // Negative thoughts
  if (/(impostor|not good enough|failure|worthless|mistake|always fail|perfection)/i.test(lower)) {
    return {
      reply: `Notice how harsh that inner voice can be, ${firstName}. That thought is an echo of stress, not a factual verdict on who you are. What is one piece of evidence from your past week that proves you are capable and learning?`,
      chips: ["I managed a hard task", "I showed up even when tired", "It's hard to think of one"],
      multi_select: false,
      saved_card: {
        label: "NEW THOUGHT",
        text: "Steady, compassionate effort matters more than impossible perfection."
      },
      show_support: false,
      recommended_mood: "calm",
      recommended_animation: "releaseBelief"
    };
  }

  // Default
  return {
    reply: `Thank you for sharing that with me, ${firstName}. When stress rises, the first kind thing we can do is give ourselves permission to pause for just 30 seconds. Can you soften your jaw and drop your shoulders right now? Tell me how that feels.`,
    chips: ["My shoulders were tense", "Try 6-second pulse", "Tell me more about TABY"],
    multi_select: false,
    saved_card: null,
    show_support: false,
    recommended_mood: "calm",
    recommended_animation: "comfort"
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'TABY Emotional Sovereign Companion (Node.js)',
    llm_provider: 'Qwen / DashScope',
    model: QWEN_MODEL,
    api_key_configured: Boolean(QWEN_API_KEY),
    mode: QWEN_API_KEY ? 'live_qwen' : 'intelligent_evidence_fallback'
  });
});

app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body || {};
  const firstName = (context && context.firstName) || 'Friend';
  const pillar = context && context.pillar;

  // Local safety scan
  if (/(hurt myself|kill myself|suicid|end it all|can't go on|die|self harm)/i.test(message || '')) {
    return res.json(getFallbackResponse(message, firstName));
  }

  if (!QWEN_API_KEY) {
    return res.json(getFallbackResponse(message, firstName));
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT.replace('[First Name]', firstName) }
  ];

  if (context && Array.isArray(context.history)) {
    context.history.slice(-6).forEach(t => messages.push({ role: t.role, content: t.content }));
  }

  let userPrompt = message || '';
  if (pillar) {
    userPrompt = `[Context: User is on Pillar: ${pillar}, Step: ${context.step || 2}]\nUser message: ${message}`;
  }
  messages.push({ role: 'user', content: userPrompt });

  try {
    const postData = JSON.stringify({
      model: QWEN_MODEL,
      messages: messages,
      temperature: 0.6,
      max_tokens: 400
    });

    const parsedUrl = new URL(`${QWEN_BASE_URL}/chat/completions`);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 22000
    };

    const apiReq = client.request(options, (apiRes) => {
      let body = '';
      apiRes.on('data', chunk => body += chunk);
      apiRes.on('end', () => {
        if (apiRes.statusCode !== 200) {
          console.warn(`Qwen HTTP ${apiRes.statusCode}: ${body}`);
          return res.json(getFallbackResponse(message, firstName));
        }
        try {
          const json = JSON.parse(body);
          const rawReply = json.choices[0].message.content;
          return res.json(extractJson(rawReply));
        } catch (e) {
          return res.json(getFallbackResponse(message, firstName));
        }
      });
    });

    apiReq.on('error', (err) => {
      console.error('Qwen API request error:', err.message);
      res.json(getFallbackResponse(message, firstName));
    });

    apiReq.on('timeout', () => {
      apiReq.destroy();
      res.json({
        reply: `I felt a brief delay in the network, ${firstName}, but I am right here with you. Take one slow breath. How are you feeling in this exact moment?`,
        chips: ["I'm okay", "Let's do a breathing pulse", "Retry my question"],
        multi_select: false,
        saved_card: null,
        show_support: false,
        recommended_mood: "calm",
        recommended_animation: "cyclicSigh"
      });
    });

    apiReq.write(postData);
    apiReq.end();
  } catch (err) {
    res.json(getFallbackResponse(message, firstName));
  }
});

app.post('/api/baseline', (req, res) => {
  const { heartRateBpm = 68, typingRhythmVar = 0.22 } = req.body || {};
  let stressMod = 0;
  if (heartRateBpm > 75) stressMod += (heartRateBpm - 75) * 0.4;
  if (typingRhythmVar > 0.3) stressMod += (typingRhythmVar - 0.3) * 20;

  const stress = Math.max(5, Math.min(60, 15 + stressMod));
  const calm = Math.max(10, Math.min(65, 35 - stressMod * 0.5));
  const joy = Math.max(15, Math.min(65, 45 - stressMod * 0.4));
  const anger = Math.max(2, 100 - (stress + calm + joy));

  const total = joy + calm + stress + anger;
  const joyPct = Math.round((joy / total) * 100);
  const calmPct = Math.round((calm / total) * 100);
  const stressPct = Math.round((stress / total) * 100);
  const angerPct = Math.max(0, 100 - (joyPct + calmPct + stressPct));

  const fusedIndex = Math.round(Math.min(100, Math.max(10, stress * 1.8)));
  const capacityPct = Math.round(Math.max(40, Math.min(95, 100 - fusedIndex * 0.5)));

  res.json({
    baseline: {
      joy: joyPct,
      calm: calmPct,
      stress: stressPct,
      anger: angerPct
    },
    capacity: capacityPct,
    fused_index: fusedIndex,
    streak_days: 3,
    status_label: fusedIndex < 45 ? "Everything is in flow. Stay grounded." : "Elevated activation detected.",
    recommendation: fusedIndex > 35 ? "6-second recalibration pulse" : "maintain steady pacing"
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n=======================================================`);
  console.log(`  TABY Stress-Relief Companion Server (Express) running!`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Qwen LLM API configured: ${QWEN_API_KEY ? 'YES' : 'NO (Intelligent fallback active)'}`);
  console.log(`=======================================================\n`);
});
