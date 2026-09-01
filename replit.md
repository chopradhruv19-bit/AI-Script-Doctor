# AI Script Doctor

AI Script Doctor reads a pasted screenplay through four Gemini-powered editorial passes and returns a focused report for the next draft.

## Run & Operate

- `python artifacts/ai-script-doctor/app.py` — run the Flask app and analysis API
- `pnpm --filter @workspace/ai-script-doctor run build` — build the React interface into `dist/public`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required secret: `GEMINI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- UI: React + Vite
- API: Flask + Google GenAI Python SDK
- Model: `gemini-2.5-flash`, with a narrow provider-retirement fallback to the current Gemini Flash model

## Where things live

- `artifacts/ai-script-doctor/app.py` — Flask server, `/api/analyze`, and four Gemini agent functions
- `artifacts/ai-script-doctor/src/pages/home.tsx` — single-page screenplay input and compiled report renderer
- `artifacts/ai-script-doctor/src/index.css` — manuscript workspace theme and responsive layout
- `artifacts/ai-script-doctor/requirements.txt` — Python runtime dependencies

## Architecture decisions

- The first three specialist passes run concurrently, then the compiler pass merges their JSON.
- The API returns both the compiled `report` and raw `agents` results so the UI can expose specialist-level detail without another request.
- The app intentionally keeps drafts in the current browser session; no screenplay persistence or database is used.

## Product

- Paste or load a sample screenplay.
- Request notes through structure, character, dialogue, and compiler passes.
- Read top revision priorities, act movement, character flags, dialogue naturalness, and scene notes.
- Copy the raw compiled report or start a new review.

## User preferences

The interface should remain serif-led with a monospace screenplay input, and the primary action should stay obvious.

## Gotchas

- The preview workflow runs Flask from the artifact directory, so the frontend must be rebuilt after UI changes before restarting the preview.
- The shared proxy routes `/api/analyze` to this artifact; the existing API Server health route remains separate.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
