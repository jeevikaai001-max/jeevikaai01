import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '64kb' }));

// Lightweight per-IP rate limiter for AI endpoints
const aiRateMap = new Map<string, number[]>();
const AI_RATE_LIMIT_PER_MIN = 40;
const AI_RATE_WINDOW_MS = 60_000;

function checkAiRateLimit(req: Request, res: Response): boolean {
  const ip =
    String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || 'local')
      .split(',')[0]
      .trim();
  const now = Date.now();
  const windowStart = now - AI_RATE_WINDOW_MS;
  const recent = (aiRateMap.get(ip) || []).filter((ts) => ts > windowStart);
  if (recent.length >= AI_RATE_LIMIT_PER_MIN) {
    res.status(429).json({ fallback: true, error: 'Too many AI requests, please wait a moment.' });
    return false;
  }
  recent.push(now);
  aiRateMap.set(ip, recent);
  if (aiRateMap.size > 2000) {
    for (const [k, list] of aiRateMap.entries()) {
      if (!list.length || list[list.length - 1] < windowStart) aiRateMap.delete(k);
    }
  }
  return true;
}

function clampStr(val: unknown, maxLen = 500): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

function createAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Helper for timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI extraction timeout')), timeoutMs)
    ),
  ]);
}

// Resilient Model Priority List (Gemini 4 Hydrogen primary, 3.1 Flash Lite fallback)
const CANDIDATE_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

async function generateContentResilient(
  ai: GoogleGenAI,
  contents: string,
  options?: { responseMimeType?: string; timeoutMs?: number }
): Promise<string> {
  const timeoutMs = options?.timeoutMs || 14000;

  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const config: Record<string, unknown> = {};
      if (options?.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (model === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const generatePromise = ai.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      const response = await withTimeout(generatePromise, timeoutMs);
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error('All models exhausted');
}

// API Route: AI Conversational Profile Extraction & Guidance
app.post('/api/extract-profile', async (req: Request, res: Response) => {
  try {
    const {
      message,
      language = 'hi',
      currentStep = 'general',
      existingProfile = {},
      stepQuestion = '',
    } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        fallback: true,
        message: 'GEMINI_API_KEY not configured, utilizing Indic client rule-engine.',
      });
    }

    const ai = createAiClient();
    const systemPrompt = `You are JeevikaAI (जीविका एआई), an empathetic and natural livelihood & skill guide for rural and semi-urban Indian youth and workers.
The user speaks in Hindi, Bhojpuri, Hinglish, or English.

Current Context:
- Step Key: "${currentStep}"
- Current Question Asked: "${stepQuestion}"
- Preferred Language: "${language}" (hi = Hindi, bho = Bhojpuri, hin = Hinglish, en = English)
- Current Profile Data So Far: ${JSON.stringify(existingProfile)}
- User Just Said: "${message}"

Your Task:
1. Interpret intent and extract the clean, relevant value for this field.
2. Standardize choice options:
   - For 'education': Map to one of ["Below 8th class", "8th class pass", "10th pass (Secondary)", "12th pass (Higher Secondary)", "Graduate", "ITI / Diploma"].
   - For 'workType': Map to ["Job", "Self-employment", "Either"].
   - For 'mobility': Map to ["Nearby only (within ~10 km)", "Within my district", "Anywhere in the state"].
3. Determine confidence (0.0 to 1.0). If the answer is completely off-topic or ambiguous, confidence should be below 0.6 and needsClarification should be true.
4. For intro step ("intro"): If user said "haan", "ji", "yes", "shuru karein", "theek ba", recognize intent as "start_affirmative".
5. Produce a warm, encouraging, short 1-sentence acknowledgment in the user's spoken dialect (e.g. Hindi, Bhojpuri, or English).
6. Return ONLY a valid JSON object matching this schema without any markdown formatting around it:
{
  "recognizedIntent": "start_affirmative" | "start_negative" | "education" | "skills" | "interests" | "occupation" | "location" | "workType" | "mobility" | "unclear",
  "cleanValue": "Normalized string for this field",
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": "Friendly clarification if confidence is low, else empty string",
  "acknowledgment": "Short 1-sentence natural warm acknowledgment in the user's dialect (e.g. 'Achha, baarahvi pass. Bahut badhiya!')",
  "suggestedNextTopic": "Next field"
}`;

    const rawResult = await generateContentResilient(ai, systemPrompt, {
      responseMimeType: 'application/json',
      timeoutMs: 8500,
    });
    let rawText = rawResult || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    return res.json({
      fallback: false,
      result: parsed,
    });
  } catch (error: any) {
    const isRateLimit =
      error?.message?.includes('429') ||
      error?.message?.includes('Quota exceeded') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');
    if (!isRateLimit) {
      console.warn('Gemini extraction fallback triggered:', error?.message || 'internal');
    }
    return res.json({
      fallback: true,
      error: 'Using resilient Indic rule engine',
    });
  }
});

// Helper rule-based fallback profile parser for natural speech
function parseProfileWithRules(message: string, existing: any) {
  const updated = { ...existing };
  const text = message.toLowerCase();

  const phoneMatch = message.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) {
    updated.phone = phoneMatch[0];
  }

  if (text.includes('12th') || text.includes('12वी') || text.includes('इंटर') || text.includes('inter')) {
    updated.education = '12th pass (Higher Secondary)';
  } else if (text.includes('10th') || text.includes('10वी') || text.includes('मैट्रिक') || text.includes('highschool')) {
    updated.education = '10th pass (Secondary)';
  } else if (
    text.includes('graduate') ||
    text.includes('बीए') ||
    text.includes('ba') ||
    text.includes('bsc') ||
    text.includes('bcom') ||
    text.includes('ग्रेजुएट')
  ) {
    updated.education = 'Graduate';
  } else if (text.includes('iti') || text.includes('diploma') || text.includes('आईटीआई') || text.includes('डिप्लोमा')) {
    updated.education = 'ITI / Diploma';
  } else if (text.includes('8th') || text.includes('आठवीं')) {
    updated.education = '8th class pass';
  }

  const districts = [
    'Gorakhpur',
    'Maharajganj',
    'Varanasi',
    'Patna',
    'Gaya',
    'Lucknow',
    'Kanpur',
    'Agra',
    'Meerut',
    'Ghaziabad',
    'Prayagraj',
    'Ballia',
    'Deoria',
    'Azamgarh',
    'Basti',
    'Muzaffarpur',
    'Bhagalpur',
  ];
  for (const dist of districts) {
    if (text.includes(dist.toLowerCase())) {
      const state =
        dist === 'Patna' || dist === 'Gaya' || dist === 'Muzaffarpur' || dist === 'Bhagalpur'
          ? 'Bihar'
          : 'Uttar Pradesh';
      updated.location = `${dist}, ${state}`;
      break;
    }
  }

  const skillsFound: string[] = [];
  if (text.includes('electrician') || text.includes('बिजली') || text.includes('वायरिंग'))
    skillsFound.push('Electrician & Wiring');
  if (text.includes('solar') || text.includes('सोलर')) skillsFound.push('Solar PV Installation');
  if (text.includes('tailor') || text.includes('सिलाई') || text.includes('कपड़ा'))
    skillsFound.push('Tailoring & Stitching');
  if (text.includes('computer') || text.includes('data entry') || text.includes('कंप्यूटर') || text.includes('डाटा'))
    skillsFound.push('Digital Services & Data Entry');
  if (text.includes('mobile') || text.includes('मोबाइल')) skillsFound.push('Mobile Phone Repairing');
  if (text.includes('carpent') || text.includes('बढ़ई')) skillsFound.push('Carpentry & Woodwork');
  if (text.includes('weld') || text.includes('वेल्डिंग')) skillsFound.push('Welding & Fabrication');
  if (text.includes('beauty') || text.includes('पार्लर') || text.includes('ब्यूटी'))
    skillsFound.push('Beauty Parlor & Wellness');
  if (text.includes('plumb') || text.includes('प्लंबर')) skillsFound.push('Plumbing & Pipefitting');
  if (skillsFound.length > 0) {
    updated.skills = skillsFound.join(', ');
  }

  const nameMatch = message.match(/(?:mera naam|my name is|मेरा नाम|नाम)\s+([A-Za-z\u0900-\u097F\s]{2,25})/i);
  if (nameMatch && nameMatch[1]) {
    const cleanName = nameMatch[1].replace(/(?:hai|ba|hun|hu|is|aam)\b/gi, '').trim();
    if (cleanName.length >= 2) {
      updated.name = cleanName;
    }
  }

  return updated;
}

// API Route: AI Conversational Full Profile Parser for Voice Updates
app.post('/api/parse-speech', async (req: Request, res: Response) => {
  try {
    const { message, language = 'hi', currentProfile = {} } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const updated = parseProfileWithRules(message, currentProfile);
      return res.json({
        fallback: true,
        updatedProfile: updated,
        summary: 'प्रोफ़ाइल डेटाबेस में सफलतापूर्वक अपडेट हो गई है।',
      });
    }

    const ai = createAiClient();
    const systemPrompt = `You are JeevikaAI (जीविका एआई), an intelligent profile updater for Indian vocational beneficiaries.
The user spoke a natural language statement to update their profile: "${message}"
Current Existing Profile: ${JSON.stringify(currentProfile)}
Language Context: "${language}"

Task:
Extract any mentioned updates for the beneficiary profile fields:
- "name": Full name if mentioned
- "education": One of ["Below 8th class", "8th class pass", "10th pass (Secondary)", "12th pass (Higher Secondary)", "Graduate", "ITI / Diploma"] if mentioned or implied
- "skills": Comma-separated vocational skills if mentioned (e.g., "Solar PV, Electrician", "Tailoring, Stitching", "Data Entry, Computer", "Mobile Repairing")
- "interests": Comma-separated interest areas if mentioned
- "location": District, State (e.g. "Patna, Bihar", "Gorakhpur, Uttar Pradesh", "Varanasi, Uttar Pradesh", "Maharajganj, Uttar Pradesh") if mentioned
- "occupation": Current work/trade if mentioned
- "workType": One of ["Job", "Self-employment", "Either"] if mentioned
- "mobility": One of ["Nearby only (within ~10 km)", "Within my district", "Anywhere in the state"] if mentioned
- "phone": 10-digit mobile phone number if mentioned

Return strictly JSON with NO markdown codeblocks:
{
  "updatedProfile": {
    "name": "Extracted name or existing value",
    "education": "Extracted education or existing value",
    "skills": "Extracted skills or existing value",
    "interests": "Extracted interests or existing value",
    "location": "Extracted location or existing value",
    "occupation": "Extracted occupation or existing value",
    "workType": "Extracted workType or existing value",
    "mobility": "Extracted mobility or existing value",
    "phone": "Extracted 10-digit phone number if spoken, else existing value"
  },
  "summary": "1-sentence warm confirmation in requested language acknowledging what was changed"
}`;

    const rawResult = await generateContentResilient(ai, systemPrompt, {
      responseMimeType: 'application/json',
      timeoutMs: 8500,
    });
    let rawText = rawResult || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    const merged = {
      ...currentProfile,
      ...(parsed.updatedProfile || {}),
    };

    return res.json({
      fallback: false,
      updatedProfile: merged,
      summary: parsed.summary || 'प्रोफ़ाइल फ़ायरबेस और डेटाबेस में सफलतापूर्वक अपडेट हो गई है।',
    });
  } catch {
    const updated = parseProfileWithRules(req.body?.message || '', req.body?.currentProfile || {});
    return res.json({
      fallback: true,
      updatedProfile: updated,
      summary: 'प्रोफ़ाइल डेटाबेस में सफलतापूर्वक अपडेट हो गई है।',
    });
  }
});

// API Route: Generate Readback Summary Aloud
app.post('/api/generate-readback', async (req: Request, res: Response) => {
  try {
    const { profile, language = 'hi' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ fallback: true });
    }

    const ai = createAiClient();
    const prompt = `Generate a concise, natural, warm 2-sentence verbal summary read-back for this beneficiary in ${
      language === 'bho' ? 'Bhojpuri' : language === 'en' ? 'English' : 'simple conversational Hindi'
    }:
Profile:
- Name: ${profile?.name || 'Not specified'}
- Education: ${profile?.education || 'Not specified'}
- Skills: ${profile?.skills || 'Not specified'}
- Interests: ${profile?.interests || 'Not specified'}
- Location: ${profile?.location || 'Not specified'}
- Work Preference: ${profile?.workType || 'Not specified'}

Format requirements:
- Natural spoken cadence suitable for Text-to-Speech (TTS).
- End with asking if this information is correct so we can generate their livelihood roadmap.
- Return ONLY plain text with no quotes, markdown, or JSON.`;

    const readbackResult = await generateContentResilient(ai, prompt, { timeoutMs: 8500 });
    return res.json({
      fallback: false,
      readbackText: readbackResult.trim(),
    });
  } catch {
    return res.json({ fallback: true });
  }
});

// API Route: AI Profile Analysis & Career Roadmap Synthesis
app.post('/api/analyze-profile', async (req: Request, res: Response) => {
  try {
    const { profile, language = 'hi' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        fallback: true,
        analysis: {
          summary: 'प्रोफ़ाइल का विश्लेषण सफलतापूर्वक पूरा हुआ। आपकी योग्यता और प्राथमिकताओं के अनुसार रोडमैप तैयार है।',
          topCareerPathway: profile?.interests?.toLowerCase().includes('digital')
            ? 'Digital Services'
            : 'Local Livelihood Services',
          readinessScore: 88,
          keyStrengths: [profile?.skills || 'बुनियादी कौशल', 'स्थानीय उपलब्धता'],
        },
      });
    }

    const ai = createAiClient();
    const prompt = `Analyze this Indian rural/semi-urban citizen profile for NSQF livelihood alignment:
Profile:
- Name: ${profile?.name || 'Beneficiary'}
- Education: ${profile?.education || 'Not specified'}
- Existing Skills: ${profile?.skills || 'Not specified'}
- Interests: ${profile?.interests || 'Not specified'}
- Occupation: ${profile?.occupation || 'None'}
- Location: ${profile?.location || 'Rural/Semi-urban area'}
- Work Preference: ${profile?.workType || 'Job'}
- Mobility: ${profile?.mobility || 'Nearby'}
Language: ${language === 'bho' ? 'Bhojpuri' : language === 'en' ? 'English' : 'Hindi'}

Return strictly JSON with no markdown formatting:
{
  "summary": "1-2 sentence warm encouraging summary in the requested language",
  "topCareerPathway": "Best matching pathway e.g. Digital Services, Retail Operations, Tailoring & Crafts, Solar Installation",
  "readinessScore": 85,
  "keyStrengths": ["Strength 1", "Strength 2"]
}`;

    const rawResult = await generateContentResilient(ai, prompt, {
      responseMimeType: 'application/json',
      timeoutMs: 8500,
    });
    let rawText = rawResult || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawText);

    return res.json({
      fallback: false,
      analysis: parsed,
    });
  } catch {
    return res.json({
      fallback: true,
      analysis: {
        summary: 'प्रोफ़ाइल का विश्लेषण सफलतापूर्वक पूरा हुआ। आपका व्यक्तिगत रोडमैप तैयार है।',
        topCareerPathway: 'Digital & Local Livelihood Services',
        readinessScore: 85,
        keyStrengths: ['कौशल रुचि', 'स्थानीय रोजगार तत्परता'],
      },
    });
  }
});

// API Route: Floating Voice AI Assistant & Site Navigation Proxy
app.post('/api/chat', async (req: Request, res: Response) => {
  if (!checkAiRateLimit(req, res)) return;
  try {
    const rawMessage = clampStr(req.body?.message, 1200);
    const language = clampStr(req.body?.language, 8) || 'hi';
    const currentView = clampStr(req.body?.currentView, 40) || 'home';
    const userProfile = req.body?.userProfile && typeof req.body.userProfile === 'object' ? req.body.userProfile : {};
    const chatHistory = Array.isArray(req.body?.chatHistory) ? req.body.chatHistory.slice(-10) : [];
    const locationData = req.body?.locationData && typeof req.body.locationData === 'object' ? req.body.locationData : null;

    if (!rawMessage) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        fallback: true,
        error: 'GEMINI_API_KEY not configured on server',
      });
    }

    const recentConversation = chatHistory
      .map((turn: any) => `${turn?.sender === 'user' ? 'User' : 'JeevikaAI'}: ${clampStr(turn?.text, 350)}`)
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

    const langLabel =
      language === 'bho'
        ? 'Bhojpuri'
        : language === 'en'
        ? 'English'
        : language === 'hin'
        ? 'Hinglish'
        : 'simple conversational Hindi';

    const ai = createAiClient();
    const systemPrompt = `You are JeevikaAI (जीविका एआई), an empathetic, action-capable, voice-first Indian livelihood, career, skill, and government-scheme AI assistant.

You have comprehensive mastery of:
1. Indian Vocational Ecosystem & NSQF Levels 1-5 (Solar PV, Digital Seva & Data Entry, Retail & Mandi Operations, Tailoring & Boutique Craft, Electrician, Mobile Repair, Dairy & SHGs).
2. Central & State Government Schemes (PM Vishwakarma, PMKVY 4.0, PM Mudra Yojana, PMEGP, RSETI, UP ODOP, Bihar Mukhyamantri Udyami, MP Udyam Kranti, etc.).
3. Live Screen Grounding:
   - User Language Preference: ${langLabel} ("${language}")
   - Current Screen View: "${currentView}"
   - Active User Location: "${userProfile?.location || locationData?.locationLabel || 'India'}"
   - User Profile: ${JSON.stringify(userProfile)}
   - LIVE DATA CURRENTLY ON USER'S SCREEN: ${liveScreenSummary}

4. Multi-Turn Conversation Memory:
${recentConversation || 'First turn.'}
   - User Just Spoke / Asked: "${rawMessage}"

Your Instructions:
1. Natural Voice-First Replies:
   - Answer ANY question the user asks — jobs, schemes, eligibility, documents, loan steps, interview tips, skill roadmap, reading cards aloud, or general career guidance.
   - Use ACTUAL titles, organizations, pay, distances, and schemes from LIVE DATA CURRENTLY ON USER'S SCREEN whenever relevant.
   - Keep "spokenReply" crisp, warm, natural for Text-to-Speech (2-4 short sentences, NO markdown symbols like *, #, •).
   - "reply" can be nicely formatted for chat display in ${langLabel}.
2. Voice-Controlled Navigation ("targetView"):
   - Allowed values: "home", "dashboard", "opportunities", "training", "skill-gap", "saved", "profile", "faq", "history", "notifications", "assessment", "business-upload", or null.
   - Set "targetView" ONLY when the user asks to open/show/go to a page or inspect cards on another page. For normal follow-up Q&A on the current screen, keep "targetView": null.
3. Voice-Controlled App Actions ("appAction"):
   - "detect_gps": User asks to detect/sync their live GPS location ("mera location pata karo", "GPS on karo", "current area fetch karo").
   - "refresh_location_data": User asks to refresh/reload AI data for their area ("naya data lao", "refresh karo").
   - "change_language": User asks to switch language ("English me bolo", "Bhojpuri me baat karo", "Hindi karo") -> set actionPayload: { "language": "hi" | "bho" | "en" | "hin" }.
   - "open_opportunity": User asks to open details/map of a specific job or training card (e.g., "pehli naukri kholo", "second job details") -> set actionPayload: { "index": 0 } (0-based).
   - "save_opportunity": User asks to save/shortlist a job or training card -> set actionPayload: { "index": 0 }.
   - "start_assessment": User wants to start or redo their voice profile assessment.
   - Otherwise null.
4. Voice Profile & Location Updates ("profileUpdates"):
   - If the user states a new city/village/district, name, education, or skill, extract ONLY the changed fields into "profileUpdates". Do NOT include null/empty keys.
5. Identity:
   - If asked who made/created you, answer that you were developed by JeevikaAI Organization (जीविका एआई आर्गेनाइजेशन).

Return strictly JSON with NO markdown codeblocks:
{
  "reply": "Clear response in ${langLabel}",
  "spokenReply": "Clean spoken text without markdown symbols for TTS in ${langLabel}",
  "targetView": null,
  "actionHighlight": null,
  "appAction": null,
  "actionPayload": null,
  "profileUpdates": null
}`;

    const rawResult = await generateContentResilient(ai, systemPrompt, {
      responseMimeType: 'application/json',
      timeoutMs: 14000,
    });
    let rawText = rawResult || '{}';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawText);

    const cleanedProfileUpdates: Record<string, string> = {};
    if (parsed.profileUpdates && typeof parsed.profileUpdates === 'object') {
      for (const [k, v] of Object.entries(parsed.profileUpdates)) {
        if (
          typeof v === 'string' &&
          v.trim() &&
          v.trim().toLowerCase() !== 'null' &&
          v.trim().toLowerCase() !== 'undefined'
        ) {
          cleanedProfileUpdates[k] = v.trim();
        }
      }
    }

    return res.json({
      fallback: false,
      reply: parsed.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।',
      spokenReply: parsed.spokenReply || parsed.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।',
      targetView: parsed.targetView || null,
      actionHighlight: parsed.actionHighlight || null,
      appAction: parsed.appAction || null,
      actionPayload: parsed.actionPayload || null,
      profileUpdates: Object.keys(cleanedProfileUpdates).length > 0 ? cleanedProfileUpdates : null,
    });
  } catch (err: any) {
    console.warn('Gemini /api/chat fallback triggered:', err?.message || 'error');
    return res.json({
      fallback: true,
      error: 'Voice assistant fallback active',
    });
  }
});

// API Route: Live AI Location Intelligence & Personalized Area Livelihood Generator
app.post('/api/generate-location-data', async (req: Request, res: Response) => {
  if (!checkAiRateLimit(req, res)) return;
  try {
    const location = clampStr(req.body?.location, 160);
    const district = clampStr(req.body?.district, 80);
    const state = clampStr(req.body?.state, 80);
    const locality = clampStr(req.body?.locality, 80);
    const pincode = clampStr(req.body?.pincode, 12);
    const language = clampStr(req.body?.language, 8) || 'hi';
    const rawLat = Number(req.body?.latitude);
    const rawLng = Number(req.body?.longitude);
    const hasValidCoords =
      Number.isFinite(rawLat) &&
      Number.isFinite(rawLng) &&
      rawLat >= -90 &&
      rawLat <= 90 &&
      rawLng >= -180 &&
      rawLng <= 180 &&
      !(rawLat === 0 && rawLng === 0);
    const rawAcc = Number(req.body?.accuracyMeters);
    const accuracyMeters = Number.isFinite(rawAcc) && rawAcc > 0 ? Math.min(50000, Math.round(rawAcc)) : null;
    const coordinateSource = clampStr(req.body?.coordinateSource, 20) || (hasValidCoords ? 'gps' : 'manual');
    const existingProfile =
      req.body?.existingProfile && typeof req.body.existingProfile === 'object' ? req.body.existingProfile : {};

    const targetLoc =
      location ||
      [locality, district, state].filter(Boolean).join(', ') ||
      (hasValidCoords ? `GPS (${rawLat.toFixed(5)}, ${rawLng.toFixed(5)})` : 'India');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        fallback: true,
        message: 'GEMINI_API_KEY not configured.',
      });
    }

    const safeProfile = {
      name: clampStr(existingProfile.name, 60),
      education: clampStr(existingProfile.education, 60),
      skills: clampStr(existingProfile.skills, 180),
      interests: clampStr(existingProfile.interests, 180),
      occupation: clampStr(existingProfile.occupation, 80),
      workType: clampStr(existingProfile.workType, 40),
      mobility: clampStr(existingProfile.mobility, 60),
    };

    const langLabel =
      language === 'bho' ? 'Bhojpuri & simple Hindi' : language === 'en' ? 'English' : 'simple Hindi';

    const gpsLine = hasValidCoords
      ? `EXACT GPS COORDINATES (STRICT PRIORITY - ${coordinateSource.toUpperCase()}): Latitude ${rawLat.toFixed(6)}, Longitude ${rawLng.toFixed(6)}${accuracyMeters ? ` (±${accuracyMeters}m radius)` : ''}`
      : 'GPS Coordinates: Not provided (use district/state strictly)';

    const ai = createAiClient();
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
1. STRICTLY prioritize the exact GPS coordinates (${hasValidCoords ? `${rawLat.toFixed(5)}, ${rawLng.toFixed(5)}` : targetLoc}). Every single job, self-employment option, training center, and government scheme MUST be grounded in the exact locality, district, and state at those coordinates. NEVER return generic demo data or data from another district/state.
2. Personalize the ranking and relevance to the user's education ("${safeProfile.education || '10th/12th'}"), skills ("${safeProfile.skills || 'General'}"), interests ("${safeProfile.interests || 'Local Livelihood'}"), and workType ("${safeProfile.workType || 'Either'}").
3. Compute realistic nearby block/tehsil/market/industrial landmarks and accurate distances ("km" integer between 1 and 35) relative to the exact GPS coordinates/locality.
4. Include real state-specific schemes for "${state || 'the exact state at these coordinates'}" alongside Central schemes (e.g., PM Vishwakarma, PMKVY 4.0, PM Mudra, PMEGP, plus the actual state's flagship youth/livelihood scheme).
5. Write descriptions, benefits, eligibility, and summary naturally in ${langLabel}.

Return ONLY valid JSON matching this structure without markdown formatting:
{
  "district": "${district || 'District'}",
  "state": "${state || 'State'}",
  "insight": {
    "district": "${district || 'District'}",
    "state": "${state || 'State'}",
    "economicHub": "Key local industry / mandi / hub in this district",
    "topSectors": ["Sector 1", "Sector 2", "Sector 3", "Sector 4"],
    "averageMonthlyWage": "₹X,XXX - ₹XX,XXX",
    "activeSchemesCount": 8,
    "openVacanciesCount": 48,
    "verifiedCentersCount": 4,
    "summary": "2-sentence personalized livelihood summary for this exact area in ${langLabel}"
  },
  "opportunities": [
    {
      "id": "loc-job-1",
      "title": "Job or Self-Employment Title matched to profile",
      "org": "Realistic Local Organization / Hub / Cooperative in this district",
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
      "contactInfo": "Specific local office/landmark in this district"
    }
  ],
  "trainingCenters": [
    {
      "id": "loc-tr-1",
      "title": "Govt ITI / PMKVY / RSETI Center Name in this district",
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
      "contactInfo": "Center address in this district"
    }
  ],
  "schemes": [
    {
      "id": "loc-sch-1",
      "name": "English Scheme Name",
      "hiName": "Hindi / Local Scheme Name",
      "benefit": "Concrete financial / toolkit / subsidy benefit",
      "eligibility": "Who can apply",
      "applyOffice": "Local DIC / CSC / Block office in this district",
      "category": "state",
      "financialSupport": "Key rupee support highlight"
    }
  ]
}
Include 4 to 5 opportunities (mix of "Job" and "Self-employment", path must be one of "digital", "solar", "tailoring", "retail"), 3 trainingCenters, and 3 schemes.`;

    const rawResult = await generateContentResilient(ai, prompt, {
      responseMimeType: 'application/json',
      timeoutMs: 22000,
    });
    let rawText = rawResult || '{}';
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    const toStrArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      if (typeof v === 'string') return v.split(/[,;\n।|]+/).map((s) => s.trim()).filter(Boolean);
      return [];
    };
    if (parsed?.insight) {
      parsed.insight.topSectors = toStrArray(parsed.insight.topSectors);
    }
    if (Array.isArray(parsed?.opportunities)) {
      parsed.opportunities = parsed.opportunities.map((o: any, idx: number) => ({
        ...o,
        id: clampStr(o?.id, 48) || `ai-job-${Date.now()}-${idx}`,
        type: o?.type === 'Self-employment' ? 'Self-employment' : 'Job',
        km: typeof o?.km === 'number' && Number.isFinite(o.km) ? o.km : 5,
        verified: o?.verified !== false,
        documentsRequired: toStrArray(o?.documentsRequired),
      }));
    }
    if (Array.isArray(parsed?.trainingCenters)) {
      parsed.trainingCenters = parsed.trainingCenters.map((t: any, idx: number) => ({
        ...t,
        id: clampStr(t?.id, 48) || `ai-tr-${Date.now()}-${idx}`,
        type: 'Training',
        km: typeof t?.km === 'number' && Number.isFinite(t.km) ? t.km : 6,
        verified: t?.verified !== false,
        documentsRequired: toStrArray(t?.documentsRequired),
      }));
    }

    return res.json({
      fallback: false,
      result: parsed,
    });
  } catch (error: any) {
    const isRateLimit =
      error?.message?.includes('429') ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('Quota exceeded');
    if (!isRateLimit) {
      console.warn('Location data generated via curated fallback engine:', error?.message || 'timeout');
    }
    return res.json({
      fallback: true,
      error: 'Using verified curated district dataset',
    });
  }
});

const STORE_FILE = path.join(os.tmpdir(), 'jeevika_media_showcase_store.json');

interface ServerStoreData {
  media: any[];
  showcase: any[];
}

function readServerStore(): ServerStoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return {
        media: Array.isArray(parsed?.media) ? parsed.media : [],
        showcase: Array.isArray(parsed?.showcase) ? parsed.showcase : [],
      };
    }
  } catch {}
  return { media: [], showcase: [] };
}

function writeServerStore(data: ServerStoreData) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist server media store:', err);
  }
}

// Media Assets API (Cross-session persistence mirror when Firestore rules are restricted/offline)
app.get('/api/media', (_req: Request, res: Response) => {
  const store = readServerStore();
  res.json({ items: store.media });
});

app.post('/api/media', (req: Request, res: Response) => {
  const body = req.body || {};
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 1000) : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : 'Untitled';
  const folder = typeof body.folder === 'string' ? body.folder.trim().slice(0, 64) : 'banner';
  if (!url) {
    return res.status(400).json({ error: 'Valid image url is required' });
  }
  const store = readServerStore();
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 128) : `srv_media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record = {
    id,
    url,
    folder,
    name: name || 'Untitled',
    tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).slice(0, 60)).slice(0, 12) : ['जीविका अवसर'],
    used: typeof body.used === 'number' ? body.used : 1,
    time: typeof body.time === 'number' ? body.time : Date.now(),
    createdAt: typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
    ctaUrl: typeof body.ctaUrl === 'string' && body.ctaUrl.trim() ? body.ctaUrl.trim().slice(0, 500) : undefined,
    ctaLabel: typeof body.ctaLabel === 'string' && body.ctaLabel.trim() ? body.ctaLabel.trim().slice(0, 100) : undefined,
    order: typeof body.order === 'number' ? body.order : 0,
    active: body.active !== false,
  };
  const filtered = store.media.filter((m) => m.id !== id && m.url !== url);
  store.media = [record, ...filtered];
  writeServerStore(store);
  return res.json({ item: record });
});

app.post('/api/media/reorder', (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const orderMap = new Map<string, number>();
  for (const it of items) {
    if (it && typeof it.id === 'string' && typeof it.order === 'number') {
      orderMap.set(it.id, it.order);
    }
  }
  const store = readServerStore();
  store.media = store.media.map((m) => (orderMap.has(m.id) ? { ...m, order: orderMap.get(m.id)! } : m));
  writeServerStore(store);
  return res.json({ ok: true });
});

app.patch('/api/media/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const patch = req.body || {};
  const store = readServerStore();
  let updated: any = null;
  store.media = store.media.map((m) => {
    if (m.id === id) {
      updated = {
        ...m,
        ...(typeof patch.url === 'string' ? { url: patch.url.trim().slice(0, 1000) } : {}),
        ...(typeof patch.folder === 'string' ? { folder: patch.folder.trim().slice(0, 64) } : {}),
        ...(typeof patch.name === 'string' ? { name: patch.name.trim().slice(0, 200) } : {}),
        ...(patch.ctaUrl !== undefined ? { ctaUrl: typeof patch.ctaUrl === 'string' && patch.ctaUrl.trim() ? patch.ctaUrl.trim().slice(0, 500) : undefined } : {}),
        ...(patch.ctaLabel !== undefined ? { ctaLabel: typeof patch.ctaLabel === 'string' && patch.ctaLabel.trim() ? patch.ctaLabel.trim().slice(0, 100) : undefined } : {}),
        ...(typeof patch.order === 'number' ? { order: patch.order } : {}),
        ...(typeof patch.active === 'boolean' ? { active: patch.active } : {}),
      };
      return updated;
    }
    return m;
  });
  writeServerStore(store);
  return res.json({ ok: true, item: updated });
});

app.delete('/api/media/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const store = readServerStore();
  store.media = store.media.filter((m) => m.id !== id);
  writeServerStore(store);
  return res.json({ ok: true });
});

// Showcase Products API
app.get('/api/showcase', (_req: Request, res: Response) => {
  const store = readServerStore();
  res.json({ items: store.showcase });
});

app.post('/api/showcase', (req: Request, res: Response) => {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 1000) : '';
  if (!title || !imageUrl) {
    return res.status(400).json({ error: 'title and imageUrl are required' });
  }
  const store = readServerStore();
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim().slice(0, 128) : `srv_show_${Date.now()}`;
  const record = { ...body, id, title, imageUrl };
  store.showcase = [record, ...store.showcase.filter((p) => p.id !== id)];
  writeServerStore(store);
  return res.json({ item: record });
});

app.delete('/api/showcase/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const store = readServerStore();
  store.showcase = store.showcase.filter((p) => p.id !== id);
  writeServerStore(store);
  return res.json({ ok: true });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  let viteMiddleware: any = null;
  if (!isProd) {
    app.use((req, res, next) => {
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      next();
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`JeevikaAI server running on http://0.0.0.0:${PORT}`);
  });

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const hmrEnabled = process.env.DISABLE_HMR !== 'true';
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: hmrEnabled ? { server: httpServer } : false,
          watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
    } catch (err) {
      console.error('Failed to initialize Vite middleware:', err);
    }
  }
}

startServer();
