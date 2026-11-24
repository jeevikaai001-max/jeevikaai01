# JeevikaAI — Voice-First Livelihood & Skill Guidance Platform

**JeevikaAI** is a multilingual, voice-first livelihood and NSQF-aligned career guidance platform built for rural, semi-urban, and first-time digital users across India. It bridges the gap between local talent and real earning opportunities in **Hindi, Bhojpuri, Hinglish, and English**.

---

## Key Platform Features

### 1. Voice-First Onboarding & Assisted Access
- **Simple Account Creation:** Citizens can register and log in using just a **10-digit mobile number and a 4-digit PIN** — no email required.
- **Voice-Guided Profile Builder:** Capture name, education, skills, interests, work preference, and exact location (village, town, district, and state) via voice or quick taps.
- **Automatic GPS Location Detection:** Detects precise area details (village/town, district, and state) automatically so guidance stays locally relevant.

### 2. Hyperlocal Personalized Dashboard
- **Area-Specific Recommendations:** Dynamically fetches and updates nearby jobs, self-employment options, skill training centers, and government schemes tailored to the user's exact district and profile.
- **Instant AI Refresh:** Users can refresh recommendations on demand whenever they update their skills or switch locations.

### 3. Voice-Interactive AI Livelihood Assistant
- **Speak & Listen Support:** Users can ask questions by speaking in Hindi, Bhojpuri, Hinglish, or English and hear spoken responses.
- **Hands-Free Actions:** The assistant guides users through schemes, jobs, training centers, and directly navigates between platform sections.

### 4. NSQF-Aligned Skill Pathways & Roadmaps
- **Smart Pathway Matching:** Recommends National Skills Qualifications Framework (NSQF) pathways based on current education, skills, and mobility.
- **3-Stage Progression Roadmap:** Step-by-step learning, apprenticeship, and placement plan with printable/downloadable PDF support.

### 5. Verified Opportunities, Training & Government Schemes
- **Jobs & Self-Employment:** Local verified jobs and self-employment leads with distance, pay range, eligibility, and required documents.
- **Training Centers:** Nearby ITI, RSETI, and PMKVY skill centers with course and enrollment details.
- **Government Welfare Schemes:** Central and state schemes (such as PM Vishwakarma, PMKVY, and PM Mudra Yojana) with clear benefits and application office details.

### 6. Local Artisan & Business Showcase
- **Community Marketplace:** Rural artisans and small business owners can publish products with photos, pricing, and direct contact details.
- **Seller Analytics:** Track product listings and engagement from a dedicated view.

### 7. Role-Based Admin & Sub-Admin Portal
- **Super Admin & Sub-Admin Access:** Super Admins can authorize Sub-Admins by Gmail address so they can sign in securely via Google 1-Click Login.
- **7-Day Activity Audit Trail:** Every addition, update, and deletion performed by Admins and Sub-Admins across jobs, pathways, media, users, and showcases is tracked in a 7-day activity log for full accountability.
- **Content & Citizen Management:** Manage citizen profiles, publish opportunities and NSQF pathways, upload banners/media, export CSV reports, and send broadcast alerts.

### 8. Offline-Ready Progressive Web App (PWA)
- Designed for mobile-first usage with installable PWA support and resilient offline caching for low-connectivity areas.

---

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **AI & Voice:** Gemini API (via secure server/edge gateway), Web Speech API (Voice Recognition & Text-to-Speech)
- **Database & Auth:** Firebase Authentication & Cloud Firestore
- **Media Storage:** Cloudinary
- **Maps & Location:** Leaflet & Reverse Geocoding

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure the required environment variables (AI gateway/API settings and media upload configuration).

### 3. Run Locally
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Security & Privacy Highlights

- Sensitive AI API keys remain server/edge-side and are never exposed in client bundles.
- Role-based access control (RBAC) separates **Beneficiaries**, **Sub-Admins**, and **Super Admins**.
- Admin and Sub-Admin authentication requires verified Google accounts, and activity audit logs are append-only to prevent tampering.
