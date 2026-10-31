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
3. Set `GEMINI_MODEL`. **Note:** You must confirm a currently supported Gemini model name in the official [Google AI Studio / Gemini documentation](https://ai.google.dev/gemini-api/docs/models/gemini) before setting `GEMINI_MODEL` (e.g. `gemini-1.5-flash` or newer). Do not guess deprecated model names.

---

## API Documentation
See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for endpoint details and JSON contracts.
