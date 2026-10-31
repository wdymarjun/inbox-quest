# Inbox Quest

Save your inbox. Save the world.

Inbox Quest transforms the chore of email cleanup into a fast-paced 3-minute mini-game mission. Playing the game maps your in-game actions directly to safe, reversible, audit-logged inbox cleanup actions.

## Key Features
- **Space Courier Mini-Game:** Fast-paced interactive runner where dodging/jumping and collecting items triggers safe triage.
- **Safety First:** Hard guarantees ensure no automatic email deletion, no archiving of high-priority or uncertain emails, and instant 1-click Undo.
- **Offline & Fallback Ready:** Works 100% offline out-of-the-box with rules-based heuristic classification and mock inboxes.
- **AI Enhancement:** Optional Gemini integration for structured email classification and confidence scoring.

---

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start the Backend Server
```bash
npm start
```
The server will start on `http://localhost:3001`.

### 3. Optional Gemini Configuration
Inbox Quest includes a robust rules-first heuristic classifier that functions fully offline with zero API keys required.

To enable optional Gemini AI classification:
1. Copy `backend/.env.example` to `backend/.env`.
2. Add your `GEMINI_API_KEY`.
3. Optionally set `GEMINI_MODEL` to an available model (the assistant defaults to `gemini-2.5-flash`).

The same server-side key enables the Inbox Quest-only help assistant. Its chat endpoint accepts questions about the site and game only; it cannot access or change email. Keep the key in the ignored backend `.env` file or your hosting provider’s secret settings, never in frontend code or Git.

---

## API Documentation
See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for endpoint details and JSON contracts.
