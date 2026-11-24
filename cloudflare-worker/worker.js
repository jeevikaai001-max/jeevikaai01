/**
 * JeevikaAI — All-in-One Production Cloudflare Worker (Gemini AI Gateway)
 *
 * Powers EVERY AI feature of JeevikaAI at the global edge with zero npm dependencies:
 *  - GET  / & /api/health               -> Health & model status check
 *  - POST /api/assessment-turn          -> Smart Conversational Voice Profile Maker
 *                                          (Clean entity extraction, multi-field capture,
 *                                           go-back, go-next, jump-to-step, edit-any-field,
 *                                           repeat, natural chitchat, readback review)
 *  - POST /api/extract-profile          -> Backwards-compatible v2 profile extraction
 *  - POST /api/parse-speech             -> Natural voice profile editor
 *  - POST /api/generate-readback        -> Natural spoken profile summary for TTS
 *  - POST /api/analyze-profile          -> NSQF Career Pathway & Readiness Synthesis
 *  - POST /api/chat                     -> Floating Voice AI Assistant (screen-grounded + actions)
 *  - POST /api/generate-location-data   -> GPS-first Hyperlocal Jobs, Training & Govt Schemes
 *
 * Setup in Cloudflare Workers Dashboard:
 *  1. Create a Worker -> Paste this entire file -> Deploy.
 *  2. Go to Worker Settings -> Variables & Secrets -> Add Secret:
 *       GEMINI_API_KEY = <your Gemini API key>
 *     (Optional for higher throughput: GEMINI_API_KEY_2, GEMINI_API_KEY_3)
 *  3. Copy your Worker URL (e.g. https://your-worker.your-subdomain.workers.dev)
 *     and connect it in JeevikaAI via VITE_CLOUDFLARE_WORKER_URL!
 */

const CANDIDATE_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jeevika-Client',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

function clampStr(val, maxLen = 600) {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

function getApiKeys(env) {
  const keys = [];
  for (const name of ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3']) {
    const k = typeof env?.[name] === 'string' ? env[name].trim() : '';
    if (k) keys.push(k);
  }
  return keys;
}

function stripMarkdownJson(raw) {
  if (!raw || typeof raw !== 'string') return '{}';
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

/**
 * Calls Google Gemini REST API directly from Cloudflare Edge with automatic
 * API-key failover & model failover (`gemini-4-hydrogen` -> `gemini-3.1-flash-lite`).
 */
async function callGemini(env, prompt, options = {}) {
  const keys = getApiKeys(env);
  if (keys.length === 0) {
    throw new Error('NO_GEMINI_API_KEY');
  }

  const expectJson = options.expectJson !== false;
  const timeoutMs = options.timeoutMs || 14000;
  let lastErr = null;

  for (const apiKey of keys) {
    for (const model of CANDIDATE_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const generationConfig = {};
        if (expectJson) {
          generationConfig.responseMimeType = 'application/json';
        }
        if (model === 'gemini-4-hydrogen') {
          generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'jeevikaai-cf-worker/2.0',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          lastErr = new Error(`Gemini ${model} HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
          continue;
        }

        const data = await resp.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts
          .map((p) => (typeof p?.text === 'string' ? p.text : ''))
          .join('')
          .trim();

        if (text) {
          return text;
        }
        lastErr = new Error(`Empty response from ${model}`);
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
      }
    }
  }

  throw lastErr || new Error('All Gemini models exhausted');
}

function getLangLabel(language) {
  if (language === 'bho') return 'natural warm Bhojpuri (Devanagari script)';
  if (language === 'en') return 'clear friendly English';
  if (language === 'hin') return 'friendly Hinglish';
  return 'natural warm conversational Hindi (Devanagari script)';
}

function buildAssessmentTurnPrompt({
  message,
  language,
  currentStep,
  stepQuestion,
  existingProfile,
  conversationHistory,
}) {
  const langLabel = getLangLabel(language);
  const historyText = (conversationHistory || [])
    .slice(-8)
    .map((h) => `${h.role === 'user' ? 'User' : 'JeevikaAI'}: ${clampStr(h.text, 240)}`)
    .join('\n');

  return `You are JeevikaAI (जीविका एआई), a super-smart, warm, human-like voice livelihood assistant helping an Indian citizen build their profile step-by-step.

PROFILE STEPS IN EXACT SEQUENCE:
1. "name" - Citizen's personal name ONLY (NEVER include filler phrases like "मेरा नाम", "है", "जी", "my name is", "मैं ... बोल रहा हूँ", "mera name ... hai"). Example: if user says "मेरा नाम आयुष गुप्ता है", cleanValue MUST be "आयुष गुप्ता" (or "Ayush Gupta" if spoken in English).
2. "education" - MUST map to one of: ["Below 8th class", "8th class pass", "10th pass (Secondary)", "12th pass (Higher Secondary)", "Graduate", "ITI / Diploma"].
3. "skills" - Clean, concise comma-separated skills (e.g., "सिलाई-कढ़ाई, कंप्यूटर" or "Electrician, Solar PV").
4. "interests" - Clean, concise comma-separated work/training interests.
5. "occupation" - Clean current work/student/homemaker/unemployed status (e.g., "छात्र", "दुकान सहायक", "गृहिणी", "अभी कोई काम नहीं").
6. "location" - Clean Village/Town, District, State (e.g., "गोरखपुर, उत्तर प्रदेश" or "Patna, Bihar").
7. "workType" - MUST map to one of: ["Job", "Self-employment", "Either"].
8. "mobility" - MUST map to one of: ["Nearby only (within ~10 km)", "Within my district", "Anywhere in the state"].

Special Step Keys:
- "intro": Asking if the user is ready to begin the profile assessment.
- "readback": Reading back the completed profile summary and asking if everything is correct or if they want to change any field.

CURRENT CONTEXT:
- Current Step Key: "${currentStep}"
- Current Question Asked: "${stepQuestion}"
- Output Language for spokenReply: ${langLabel} (code: "${language}")
- Current Saved Profile So Far: ${JSON.stringify(existingProfile || {})}
- Recent Conversation:
${historyText || '(Start of conversation)'}
- User Just Spoke: "${message}"

INTELLIGENCE & CONVERSATION RULES (CRITICAL):
1. ENTITY EXTRACTION — NEVER SAVE RAW SENTENCES:
   - Extract ONLY the clean core value. Never write "मेरा नाम आयुष है" as name; write "आयुष". Never write "मैं 12वीं पास हूँ भाई" as education; map it to "12th pass (Higher Secondary)". Never write "मैं गोरखपुर जिले में रहता हूँ" as location; write "गोरखपुर, उत्तर प्रदेश".
2. OFF-TOPIC / CASUAL CHAT / QUESTIONS ("कैसे हो", "क्या कर रहे हो", "तुम कौन हो", "समझ नहीं आया", "ये किस लिए है"):
   - DO NOT save casual chat, greetings, or questions into the profile field!
   - Set action = "chat_and_stay", cleanValue = "", needsClarification = true, and give a warm, friendly 1-2 sentence reply in ${langLabel} answering their question AND gently re-asking the current step question!
3. NAVIGATION & EDIT COMMANDS (ANYTIME IN ANY STEP):
   - Go Back ("पीछे जाओ", "पिछला सवाल", "back", "piche karo", "galat ho gaya piche chalo"): set action = "go_back", cleanValue = "", and acknowledge warmly.
   - Go Next / Skip ("आगे बढ़ो", "नेक्स्ट", "छोड़ो", "skip", "aage chalo"): set action = "go_next", cleanValue = "".
   - Repeat ("दोबारा बोलो", "फिर से पूछो", "repeat", "samajh nahi aaya"): set action = "repeat_question", cleanValue = "".
   - Jump to a specific step ("नाम बदलना है", "शिक्षा वाले पर जाओ", "शहर चेंज करो", "change my skills"):
     * If user ALSO gave the new value (e.g., "मेरा नाम गलत है आयुष गुप्ता कर दो", "पढ़ाई ग्रेजुएट कर दो"): set action = "edit_field", put the corrected field(s) in "multiFieldUpdates" (e.g. {"name": "आयुष गुप्ता"}), and confirm warmly in spokenReply!
     * If user did NOT give the new value yet (e.g., "नाम बदलना है", "शहर गलत लिखा है"): set action = "jump_to_step", targetStep = "<matching step key>", and warmly ask them for the updated value!
4. MULTI-FIELD EXTRACTION:
   - If the user naturally shares multiple details in one breath (e.g., "मेरा नाम आयुष है, मैं 12वीं पास हूँ और गोरखपुर से हूँ"), put ALL extracted clean fields in "multiFieldUpdates" AND put the current step's clean value in "cleanValue", with action = "save_and_next"!
5. INTRO STEP ("intro"):
   - If user agrees ("हाँ", "जी", "चलो", "शुरू करो", "yes", "ok", "haan", "theek ba"): set action = "start_affirmative".
   - If user directly gives their name on intro (e.g., "हाँ मेरा नाम आयुष है"): set action = "start_affirmative" AND include {"name": "आयुष"} in multiFieldUpdates!
   - If user declines ("नहीं", "अभी नहीं", "बाद में", "no"): set action = "start_negative".
   - If user asks a question ("ये क्या है?", "कैसे हो?"): set action = "chat_and_stay" and answer warmly.
6. READBACK REVIEW STEP ("readback"):
   - If user confirms ("हाँ सही है", "सब ठीक है", "ओके आगे बढ़ो", "yes", "confirm", "सही बा"): set action = "confirm_submit".
   - If user wants to change a field with new value ("नाम आयुष गुप्ता कर दो"): set action = "edit_field", multiFieldUpdates = {"name": "आयुष गुप्ता"}.
   - If user wants to change a field without new value ("शहर गलत है", "हुनर बदलना है"): set action = "jump_to_step", targetStep = "location" (or "skills").
   - If user says "नहीं गलत है" without saying which field: set action = "chat_and_stay" and warmly ask which detail they want to change (नाम, पढ़ाई, हुनर या शहर).
7. SPOKEN REPLY STYLE:
   - Keep "spokenReply" crisp, natural, friendly (1-2 short sentences, NO markdown like *, #, •) so browser TTS sounds like a real helpful human guide.

Return ONLY valid JSON with NO markdown fences:
{
  "action": "save_and_next" | "go_back" | "go_next" | "jump_to_step" | "edit_field" | "repeat_question" | "chat_and_stay" | "confirm_submit" | "start_affirmative" | "start_negative",
  "recognizedIntent": "string describing detected intent",
  "cleanValue": "Clean extracted value ONLY for currentStep, or empty string if not answering currentStep",
  "multiFieldUpdates": {},
  "targetStep": null,
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": "",
  "acknowledgment": "Short warm 1-sentence spoken confirmation in ${langLabel}",
  "spokenReply": "Natural spoken reply for TTS in ${langLabel}"
}`;
}

async function handleAssessmentTurn(body, env) {
  const message = clampStr(body?.message, 800);
  if (!message) return jsonResponse({ error: 'Message text is required' }, 400);

  const language = clampStr(body?.language, 8) || 'hi';
  const currentStep = clampStr(body?.currentStep, 32) || 'name';
  const stepQuestion = clampStr(body?.stepQuestion, 300);
  const existingProfile = body?.existingProfile && typeof body.existingProfile === 'object' ? body.existingProfile : {};
  const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory.slice(-8) : [];

  const prompt = buildAssessmentTurnPrompt({
    message,
    language,
    currentStep,
    stepQuestion,
    existingProfile,
    conversationHistory,
  });

  const raw = await callGemini(env, prompt, { expectJson: true, timeoutMs: 9000 });
  const parsed = JSON.parse(stripMarkdownJson(raw));

  const allowedKeys = new Set([
    'name',
    'education',
    'skills',
    'interests',
    'occupation',
    'location',
    'workType',
    'mobility',
  ]);
  const cleanMulti = {};
  if (parsed.multiFieldUpdates && typeof parsed.multiFieldUpdates === 'object') {
    for (const [k, v] of Object.entries(parsed.multiFieldUpdates)) {
      if (
        allowedKeys.has(k) &&
        typeof v === 'string' &&
        v.trim() &&
        v.trim().toLowerCase() !== 'null' &&
        v.trim().toLowerCase() !== 'undefined'
      ) {
        cleanMulti[k] = v.trim();
      }
    }
  }
  const targetStep =
    typeof parsed.targetStep === 'string' && allowedKeys.has(parsed.targetStep) ? parsed.targetStep : null;

  return jsonResponse({
    fallback: false,
    schemaVersion: 'v2',
    result: {
      action: parsed.action || 'save_and_next',
      recognizedIntent: parsed.recognizedIntent || currentStep,
      cleanValue: typeof parsed.cleanValue === 'string' ? parsed.cleanValue.trim() : '',
      multiFieldUpdates: Object.keys(cleanMulti).length > 0 ? cleanMulti : undefined,
      targetStep,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.94,
      needsClarification: Boolean(parsed.needsClarification || parsed.action === 'chat_and_stay'),
      clarificationQuestion: parsed.clarificationQuestion || parsed.spokenReply || '',
      acknowledgment: parsed.acknowledgment || parsed.spokenReply || '',
      spokenReply: parsed.spokenReply || parsed.acknowledgment || parsed.clarificationQuestion || '',
    },
  });
}

async function handleParseSpeech(body, env) {
  const message = clampStr(body?.message, 800);
  if (!message) return jsonResponse({ error: 'Message text is required' }, 400);

  const language = clampStr(body?.language, 8) || 'hi';
  const currentProfile = body?.currentProfile && typeof body.currentProfile === 'object' ? body.currentProfile : {};
  const prompt = `You are JeevikaAI (जीविका एआई), an intelligent profile updater for Indian vocational beneficiaries.
User spoke: "${message}"
Current Existing Profile: ${JSON.stringify(currentProfile)}
Language: "${language}"

Extract ONLY mentioned updates into JSON (keep existing values for unmentioned fields):
- "name": Clean full name (no filler words)
- "education": One of ["Below 8th class", "8th class pass", "10th pass (Secondary)", "12th pass (Higher Secondary)", "Graduate", "ITI / Diploma"]
- "skills": Comma-separated vocational skills
- "interests": Comma-separated interest areas
- "location": Village/Town, District, State
- "occupation": Current work/trade
- "workType": One of ["Job", "Self-employment", "Either"]
- "mobility": One of ["Nearby only (within ~10 km)", "Within my district", "Anywhere in the state"]
- "phone": 10-digit mobile phone if spoken

Return strictly JSON:
{
  "updatedProfile": { ... },
  "summary": "1-sentence warm confirmation in requested language"
}`;

  const raw = await callGemini(env, prompt, { expectJson: true, timeoutMs: 9000 });
  const parsed = JSON.parse(stripMarkdownJson(raw));
  return jsonResponse({
    fallback: false,
    updatedProfile: { ...currentProfile, ...(parsed.updatedProfile || {}) },
    summary: parsed.summary || 'प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई है।',
  });
}

async function handleGenerateReadback(body, env) {
  const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
  const language = clampStr(body?.language, 8) || 'hi';
  const langLabel = getLangLabel(language);
  const prompt = `Generate a crisp, natural, warm 2-sentence verbal summary read-back for this Indian citizen's profile in ${langLabel}:
- Name: ${profile.name || 'Not specified'}
- Education: ${profile.education || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}
- Interests: ${profile.interests || 'Not specified'}
- Location: ${profile.location || 'Not specified'}
- Work Preference: ${profile.workType || 'Not specified'}

Requirements:
- Smooth spoken flow for Text-to-Speech (NO quotes, markdown, bullets, or JSON).
- End by asking if everything is correct or if they want to change any detail.`;

  const text = await callGemini(env, prompt, { expectJson: false, timeoutMs: 8500 });
  return jsonResponse({
    fallback: false,
    readbackText: text.replace(/[*#`"]/g, '').trim(),
  });
}

async function handleAnalyzeProfile(body, env) {
  const profile = body?.profile && typeof body.profile === 'object' ? body.profile : {};
  const language = clampStr(body?.language, 8) || 'hi';
  const langLabel = getLangLabel(language);
  const prompt = `Analyze this Indian citizen profile for NSQF livelihood alignment in ${langLabel}:
${JSON.stringify(profile)}

Return strictly JSON:
{
  "summary": "1-2 sentence warm encouraging summary in ${langLabel}",
  "topCareerPathway": "Best matching pathway e.g. Digital Services, Retail Operations, Tailoring & Crafts, Solar Installation",
  "readinessScore": 86,
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"]
}`;

  const raw = await callGemini(env, prompt, { expectJson: true, timeoutMs: 9500 });
  const parsed = JSON.parse(stripMarkdownJson(raw));
  return jsonResponse({ fallback: false, analysis: parsed });
}

async function handleChat(body, env) {
  const rawMessage = clampStr(body?.message, 1200);
  if (!rawMessage) return jsonResponse({ error: 'Message text is required' }, 400);

  const language = clampStr(body?.language, 8) || 'hi';
  const currentView = clampStr(body?.currentView, 40) || 'home';
  const userProfile = body?.userProfile && typeof body.userProfile === 'object' ? body.userProfile : {};
  const chatHistory = Array.isArray(body?.chatHistory) ? body.chatHistory.slice(-10) : [];
  const locationData = body?.locationData && typeof body.locationData === 'object' ? body.locationData : null;
  const langLabel = getLangLabel(language);

  const recentConversation = chatHistory
    .map((t) => `${t?.sender === 'user' ? 'User' : 'JeevikaAI'}: ${clampStr(t?.text, 300)}`)
    .join('\n');

  const liveScreenSummary = locationData
    ? JSON.stringify({
        location: locationData.locationLabel || `${locationData.district || ''}, ${locationData.state || ''}`,
        jobsOnScreen: (locationData.opportunities || []).slice(0, 6),
        trainingCentersOnScreen: (locationData.trainingCenters || []).slice(0, 5),
        schemesOnScreen: (locationData.schemes || []).slice(0, 5),
        districtInsight: locationData.insight || null,
      })
    : 'No district cards loaded yet';

  const prompt = `You are JeevikaAI (जीविका एआई), an empathetic, action-capable, voice-first Indian livelihood, career, skill, and government-scheme AI assistant developed by JeevikaAI Organization.

Context:
- Preferred Language: ${langLabel} ("${language}")
- Current Screen View: "${currentView}"
- User Profile: ${JSON.stringify(userProfile)}
- Live Data On Screen: ${liveScreenSummary}
- Conversation Memory:
${recentConversation || 'First turn.'}
- User Just Spoke / Asked: "${rawMessage}"

Instructions:
1. Give accurate, warm, practical answers grounded in Indian NSQF pathways, Central & State schemes (PM Vishwakarma, PMKVY 4.0, PM Mudra, PMEGP, RSETI, ODOP, etc.) and live screen data.
2. Keep "spokenReply" crisp & TTS-friendly (2-4 short sentences, NO markdown symbols).
3. "targetView": one of "home", "dashboard", "opportunities", "training", "skill-gap", "saved", "profile", "faq", "history", "notifications", "assessment", "business-upload", or null (set ONLY if user explicitly asks to open/navigate).
4. "appAction": "detect_gps" | "refresh_location_data" | "change_language" | "open_opportunity" | "save_opportunity" | "start_assessment" | null.
5. "profileUpdates": object containing ONLY newly mentioned fields (name, education, skills, location, etc.), else null.

Return strictly JSON:
{
  "reply": "Clear response in ${langLabel}",
  "spokenReply": "Clean spoken text for TTS in ${langLabel}",
  "targetView": null,
  "actionHighlight": null,
  "appAction": null,
  "actionPayload": null,
  "profileUpdates": null
}`;

  const raw = await callGemini(env, prompt, { expectJson: true, timeoutMs: 14000 });
  const parsed = JSON.parse(stripMarkdownJson(raw));

  const cleanedUpdates = {};
  if (parsed.profileUpdates && typeof parsed.profileUpdates === 'object') {
    for (const [k, v] of Object.entries(parsed.profileUpdates)) {
      if (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null') {
        cleanedUpdates[k] = v.trim();
      }
    }
  }

  return jsonResponse({
    fallback: false,
    reply: parsed.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।',
    spokenReply: parsed.spokenReply || parsed.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।',
    targetView: parsed.targetView || null,
    actionHighlight: parsed.actionHighlight || null,
    appAction: parsed.appAction || null,
    actionPayload: parsed.actionPayload || null,
    profileUpdates: Object.keys(cleanedUpdates).length > 0 ? cleanedUpdates : null,
  });
}

async function handleGenerateLocationData(body, env) {
  const location = clampStr(body?.location, 160);
  const district = clampStr(body?.district, 80);
  const state = clampStr(body?.state, 80);
  const locality = clampStr(body?.locality, 80);
  const pincode = clampStr(body?.pincode, 12);
  const language = clampStr(body?.language, 8) || 'hi';
  const rawLat = Number(body?.latitude);
  const rawLng = Number(body?.longitude);
  const hasValidCoords =
    Number.isFinite(rawLat) &&
    Number.isFinite(rawLng) &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180 &&
    !(rawLat === 0 && rawLng === 0);
  const rawAcc = Number(body?.accuracyMeters);
  const accuracyMeters = Number.isFinite(rawAcc) && rawAcc > 0 ? Math.min(50000, Math.round(rawAcc)) : null;
  const coordinateSource = clampStr(body?.coordinateSource, 20) || (hasValidCoords ? 'gps' : 'manual');
  const existingProfile = body?.existingProfile && typeof body.existingProfile === 'object' ? body.existingProfile : {};

  const targetLoc =
    location ||
    [locality, district, state].filter(Boolean).join(', ') ||
    (hasValidCoords ? `GPS (${rawLat.toFixed(5)}, ${rawLng.toFixed(5)})` : 'India');

  const safeProfile = {
    name: clampStr(existingProfile.name, 60),
    education: clampStr(existingProfile.education, 60),
    skills: clampStr(existingProfile.skills, 180),
    interests: clampStr(existingProfile.interests, 180),
    occupation: clampStr(existingProfile.occupation, 80),
    workType: clampStr(existingProfile.workType, 40),
    mobility: clampStr(existingProfile.mobility, 60),
  };

  const langLabel = getLangLabel(language);
  const gpsLine = hasValidCoords
    ? `EXACT GPS COORDINATES (STRICT PRIORITY - ${coordinateSource.toUpperCase()}): Latitude ${rawLat.toFixed(
        6
      )}, Longitude ${rawLng.toFixed(6)}${accuracyMeters ? ` (±${accuracyMeters}m radius)` : ''}`
    : 'GPS Coordinates: Not provided (use district/state strictly)';

  const prompt = `You are the Live Hyperlocal Livelihood Intelligence Engine for JeevikaAI in India.
${gpsLine}
Target Exact Area: "${targetLoc}"
Locality/Village/Town: "${locality || 'Resolve from GPS coordinates'}"
District: "${district || 'Resolve from GPS coordinates'}"
State: "${state || 'Resolve from GPS coordinates'}"
Pincode: "${pincode || 'Not specified'}"
Preferred Output Language: ${langLabel}
Personalized User Profile: ${JSON.stringify(safeProfile)}

CRITICAL ACCURACY RULES:
1. STRICTLY prioritize the exact GPS coordinates (${hasValidCoords ? `${rawLat.toFixed(5)}, ${rawLng.toFixed(5)}` : targetLoc}). Every single job, self-employment option, training center, and government scheme MUST be grounded in the exact locality, district, and state at those coordinates. NEVER return generic demo data from another district/state.
2. Personalize ranking for the user's education, skills, interests, and workType.
3. Compute realistic nearby block/tehsil/market landmarks and distances ("km" integer 1-35).
4. Include real state-specific schemes alongside Central schemes (PM Vishwakarma, PMKVY 4.0, PM Mudra, PMEGP).
5. Write descriptions, benefits, eligibility, and summary naturally in ${langLabel}.

Return ONLY valid JSON:
{
  "district": "${district || 'District'}",
  "state": "${state || 'State'}",
  "insight": {
    "district": "${district || 'District'}",
    "state": "${state || 'State'}",
    "economicHub": "Key local industry / mandi / hub",
    "topSectors": ["Sector 1", "Sector 2", "Sector 3", "Sector 4"],
    "averageMonthlyWage": "₹X,XXX - ₹XX,XXX",
    "activeSchemesCount": 8,
    "openVacanciesCount": 48,
    "verifiedCentersCount": 4,
    "summary": "2-sentence personalized livelihood summary in ${langLabel}"
  },
  "opportunities": [
    {
      "id": "loc-job-1",
      "title": "Job or Self-Employment Title",
      "org": "Realistic Local Organization / Hub in this district",
      "type": "Job",
      "loc": "Specific Locality/Market, District",
      "km": 4,
      "pay": "₹10,000 - ₹15,000 / month",
      "path": "digital",
      "verified": true,
      "source": "Local District Registry / Cluster",
      "lastVerifiedDate": "November 2026",
      "eligibility": "Clear eligibility",
      "documentsRequired": ["Aadhaar Card", "Education Certificate", "Bank Passbook"],
      "contactInfo": "Specific local office/landmark"
    }
  ],
  "trainingCenters": [
    {
      "id": "loc-tr-1",
      "title": "Govt ITI / PMKVY / RSETI Center Name",
      "org": "Government / Lead Bank Skill Authority",
      "type": "Training",
      "loc": "Specific Road/Area, District",
      "km": 5,
      "pay": "100% Free Govt Course + Skill India Certificate",
      "path": "digital",
      "verified": true,
      "source": "Skill India / NCVT / MoRD RSETI",
      "lastVerifiedDate": "November 2026",
      "eligibility": "Clear eligibility",
      "documentsRequired": ["Aadhaar Card", "Marksheet"],
      "contactInfo": "Center address"
    }
  ],
  "schemes": [
    {
      "id": "loc-sch-1",
      "name": "English Scheme Name",
      "hiName": "Hindi / Local Scheme Name",
      "benefit": "Concrete financial / toolkit / subsidy benefit",
      "eligibility": "Who can apply",
      "applyOffice": "Local DIC / CSC / Block office",
      "category": "state",
      "financialSupport": "Key rupee support highlight"
    }
  ]
}
Include 4 to 5 opportunities (mix of "Job" and "Self-employment", path one of "digital", "solar", "tailoring", "retail"), 3 trainingCenters, and 3 schemes.`;

  const raw = await callGemini(env, prompt, { expectJson: true, timeoutMs: 22000 });
  const parsed = JSON.parse(stripMarkdownJson(raw));

  const toStrArray = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[,;\n।|]+/).map((s) => s.trim()).filter(Boolean);
    return [];
  };

  if (parsed?.insight) {
    parsed.insight.topSectors = toStrArray(parsed.insight.topSectors);
  }
  if (Array.isArray(parsed?.opportunities)) {
    parsed.opportunities = parsed.opportunities.map((o, idx) => ({
      ...o,
      id: clampStr(o?.id, 48) || `ai-job-${Date.now()}-${idx}`,
      type: o?.type === 'Self-employment' ? 'Self-employment' : 'Job',
      km: typeof o?.km === 'number' && Number.isFinite(o.km) ? o.km : 5,
      verified: o?.verified !== false,
      documentsRequired: toStrArray(o?.documentsRequired),
    }));
  }
  if (Array.isArray(parsed?.trainingCenters)) {
    parsed.trainingCenters = parsed.trainingCenters.map((t, idx) => ({
      ...t,
      id: clampStr(t?.id, 48) || `ai-tr-${Date.now()}-${idx}`,
      type: 'Training',
      km: typeof t?.km === 'number' && Number.isFinite(t.km) ? t.km : 6,
      verified: t?.verified !== false,
      documentsRequired: toStrArray(t?.documentsRequired),
    }));
  }

  return jsonResponse({ fallback: false, result: parsed });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET' && (path === '/' || path === '/api/health')) {
      return jsonResponse({
        status: 'ok',
        service: 'JeevikaAI Edge Gemini Worker v2',
        geminiConfigured: getApiKeys(env).length > 0,
        models: CANDIDATE_MODELS,
        routes: [
          '/api/health',
          '/api/assessment-turn',
          '/api/extract-profile',
          '/api/parse-speech',
          '/api/generate-readback',
          '/api/analyze-profile',
          '/api/chat',
          '/api/generate-location-data',
        ],
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    try {
      if (path === '/api/assessment-turn' || path === '/api/extract-profile') {
        return await handleAssessmentTurn(body, env);
      }
      if (path === '/api/parse-speech') {
        return await handleParseSpeech(body, env);
      }
      if (path === '/api/generate-readback') {
        return await handleGenerateReadback(body, env);
      }
      if (path === '/api/analyze-profile') {
        return await handleAnalyzeProfile(body, env);
      }
      if (path === '/api/chat') {
        return await handleChat(body, env);
      }
      if (path === '/api/generate-location-data') {
        return await handleGenerateLocationData(body, env);
      }

      return jsonResponse({ error: 'Route not found', path }, 404);
    } catch (err) {
      return jsonResponse({
        fallback: true,
        error: err?.message === 'NO_GEMINI_API_KEY'
          ? 'GEMINI_API_KEY secret is not configured in Cloudflare Worker.'
          : 'Upstream Gemini request failed; fallback enabled.',
      });
    }
  },
};
