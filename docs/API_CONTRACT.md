# Inbox Quest API Contract

Base URL in local development: `http://localhost:3001`

---

## 1. GET `/api/inbox?size=10|25|50`

Fetches a batch of simulated or demo inbox emails.

### Request Query Parameters
- `size` (optional, default: `25`): Batch size, must be `10`, `25`, or `50`.

### Response (200 OK)
An array of email objects:
```json
[
  {
    "id": "string",
    "sender": "string",
    "subject": "string",
    "snippet": "string",
    "date": "YYYY-MM-DD"
  }
]
```

---

## 2. POST `/api/classify`

Classifies a batch of emails using rule-based heuristics and optional Gemini structured reasoning.

### Request Body
```json
{
  "emails": [
    {
      "id": "string",
      "sender": "string",
      "subject": "string",
      "snippet": "string",
      "date": "YYYY-MM-DD"
    }
  ]
}
```

### Response (200 OK)
An array of classification results:
```json
[
  {
    "id": "string",
    "category": "promotion | newsletter | important | receipt_bill | read_later | uncertain",
    "priority": "high | medium | low",
    "confidence": 0.0,
    "reason": "string",
    "suggested_action": "archive | label_read_later | flag_important | leave_in_inbox | needs_review"
  }
]
```

### Hard Safety Rules Mandated by Contract
- Any item with `confidence < 0.85` **MUST** have `suggested_action: "needs_review"`.
- `suggested_action` **NEVER** equals `"delete"`.
- `archive` is forbidden for `priority: "high"` and forbidden for `category: "uncertain"`.

---

## 3. POST `/api/actions/apply`

Applies a batch of inbox actions with safety guardrails and audit logging.

### Request Body
```json
{
  "actions": [
    {
      "email_id": "string",
      "action": "archive | label_read_later | flag_important | leave_in_inbox"
    }
  ]
}
```

### Response (200 OK)
```json
{
  "applied": [
    {
      "action_id": "string",
      "email_id": "string",
      "action": "string",
      "applied_at": "ISO-8601 string"
    }
  ],
  "rejected": [
    {
      "email_id": "string",
      "reason": "string"
    }
  ]
}
```

### Safety Rules
- Any action `delete` **must** be rejected with `"Deletions are forbidden"`.
- Applying `archive` on high-priority or uncertain emails **must** be rejected with `"Cannot archive high-priority or uncertain email"`.

---

## 4. POST `/api/actions/undo`

Reverses previously applied actions.

### Request Body
```json
{
  "action_ids": [
    "string"
  ]
}
```

### Response (200 OK)
```json
{
  "undone": [
    "string"
  ],
  "failed": [
    {
      "action_id": "string",
      "reason": "string"
    }
  ]
}
```

---

## 5. GET `/api/summary`

Retrieves audit metrics and summary of reviewed, organized, and protected emails.

### Response (200 OK)
```json
{
  "total_reviewed": 0,
  "archived": 0,
  "labeled_read_later": 0,
  "flagged_important": 0,
  "left_in_inbox": 0,
  "uncertain_unmodified": 0,
  "high_priority_protected": 0
}
```

---

## Gmail Inbox Frontend Contract

The current backend serves demo data from `GET /api/inbox` and does not yet expose Google OAuth or live Gmail operations. The frontend fails closed for Gmail: it must not treat a demo response or a local fallback as a connected mailbox.

### OAuth session endpoints expected by the frontend

- `GET /api/auth/status` returns `{ "configured": boolean, "authenticated": boolean, "user": { "email": "...", "name": "...", "picture": "..." } | null }`.
- `GET /api/auth/google` starts the backend-managed Google OAuth redirect. Google collects credentials and consent; the frontend must never collect passwords or verification codes.
- `POST /api/auth/logout` clears the server-side session.

OAuth tokens must stay on the backend, protected by a secure HTTP-only session cookie. Do not return OAuth access or refresh tokens to the browser.

### GET `/api/inbox?source=gmail&size=10|25|50`

Requires an authenticated session. The response must positively identify its source so the frontend can distinguish Gmail from demo data:

```json
{
  "source": "gmail",
  "emails": [
    {
      "id": "provider-message-id",
      "sender": "sender@example.com",
      "subject": "Example subject",
      "snippet": "Short message preview",
      "date": "YYYY-MM-DD"
    }
  ]
}
```

Do not include message bodies or tokens in this list response. The inbox UI is a review-only step; it does not change messages.

### Gmail actions expected by the frontend

- `POST /api/gmail/actions/apply` accepts the same safe action list as `/api/actions/apply`, requires an authenticated session, and applies only confirmed actions to the signed-in account. Reject deletion and enforce `safety.js` rules server-side. Return the same `applied` / `rejected` response shape as `/api/actions/apply`.
- `POST /api/gmail/actions/undo` accepts `action_ids`, restores the exact prior Gmail label state for each applied action where possible, and returns the same `undone` / `failed` response shape as `/api/actions/undo`.

The backend must store enough prior Gmail state to support undo. A frontend OAuth session or inbox preview is not authorization to apply actions; the user must confirm the action-review dialog first. If these Gmail endpoints are unavailable, frontend Gmail actions must fail visibly and must not report local-only success.


---

## 6. POST `/api/assistant/chat`

Dedicated in-product help assistant for Inbox Quest. The assistant is strictly limited to explaining Inbox Quest itself (gameplay controls, demo mode, navigation, scoring, safety rules, and Google/Gmail workflows). It rejects out-of-scope requests, coding/scripting questions, and prompt-override attempts.

### Request Body
```json
{
  "message": "How do I jump?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you with Inbox Quest?" }
  ],
  "pageContext": {
    "screen": "game"
  }
}
```

### Input Limits
- `message` (required): Non-empty string, trimmed, maximum 1,000 characters.
- `history` (optional): Array of up to 6 objects with `role` (`"user"` or `"assistant"`) and non-empty `content` (max 1,000 characters each).
- `pageContext.screen` (optional): Must be one of `landing`, `setup`, `inbox`, `game`, `results`. All other fields or unknown screens are rejected.
- Request payload must not contain arbitrary keys (`systemPrompt`, `tools`, `model`, etc.).

### Response (200 OK)
```json
{
  "answer": "Press Space or Up Arrow to jump. On mobile, tap the on-screen Jump control."
}
```

### Error Responses
- `400 Bad Request`: Missing or invalid `message`, oversized payload, invalid `history` roles, or disallowed parameters.
- `429 Too Many Requests`: Rate limit exceeded (default 20 requests per minute per IP).
- `502 Bad Gateway`: Gemini API provider failure or request timeout (10 seconds).
- `503 Service Unavailable`: `GEMINI_API_KEY` is not configured on the backend server.
