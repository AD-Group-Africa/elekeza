# Elekeza – Inclusive Learning Platform

A pilot‑ready, installable PWA for learners with special educational needs (SNE).  
Built with Next.js 15, Spring Boot, FastAPI, and PostgreSQL.

## Quick Start
1. Open the `frontend` folder.
2. Run `npm install && npm run build --webpack && npm run start`.
3. Open `http://localhost:3000` in your browser.
4. Use demo account: `student@elekeza.org` / `student@123`

## Project Structure
- `frontend/` – Next.js PWA (ready for pilot)
- `backend/` – Spring Boot API (requires fixing)
- `ai-elewa/` – FastAPI AI service (requires environment setup)
- `docs/` – Architecture & developer handover

## Pilot Readiness
The frontend PWA is fully functional and demonstrates the complete learner flow:
- Login → Student Home → Lesson with TTS → Adaptive Quiz → Score → Progress History
- Works offline
- Installable on any device
- Accessibility‑first design (WCAG 2.2 AA)
