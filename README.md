# AnyLearn Plugin

The ChatGPT / Claude plugin version of AnyLearn (separate from the earlier AnyLearn app).


Turn anything into an interactive course, using your own ChatGPT or Claude.

Learners describe what they want to learn (and can attach a PDF, photos or notes). Their own ChatGPT or Claude writes the course through the AnyLearn MCP server, and AnyLearn hosts it as a Brilliant-style interactive course with Duolingo-style spaced repetition. AnyLearn never calls an AI model itself.

The interface is in English. Courses can be in any language, including right-to-left scripts.

## Status

| Phase | What | Status |
|---|---|---|
| 1 | Course format + web player (lessons, reviews, streak/XP) | **Done** |
| 2 | MCP server, database, share links, thumbnails | **Done** |
| 3 | In-chat course card (MCP Apps UI) | **Done** |
| 4 | Attached files (PDF, images) | |
| 5 | Accounts and progress sync | |
| 6 | Interactive cards: true/false, select all, match pairs, tap the picture, slider simulations | **Done** |
| 7 | Launch and directory submissions | |

## Run it

Requires **Node.js 20.9 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a sample course (English, Bangla, or Arabic for right-to-left).

Without a database, only the sample courses work. To build courses through MCP locally, copy `.env.example` to `.env.local` and set `DATABASE_URL`.

## Deploy (Supabase + Vercel)

**1. Database (once).** In the Supabase dashboard open **SQL Editor → New query**, paste `supabase/migrations/0001_anylearn.sql`, replace `CHANGE_ME_STRONG_PASSWORD` with a long random password (letters and digits), and run it. It creates:

- schema `anylearn_plugin` with table `courses` (nothing else in the project is touched),
- role `anylearn_plugin_app`, which can only use that schema,
- public storage bucket `anylearn-plugin` for thumbnails.

**2. Storage key (optional).** Dashboard → **Storage → S3 Connection → New access key**. Without it, thumbnails are rendered on demand instead of stored.

**3. Vercel.** Import the GitHub repo, then add environment variables (see `.env.example`):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://anylearn_plugin_app.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY` | from step 2 |

Functions run in Singapore (`vercel.json`), next to the Supabase project.

**4. Connect an AI app.** The MCP endpoint is `https://<your-app>.vercel.app/api/mcp`.

- **Claude:** Settings → Connectors → Add custom connector → paste the URL.
- **ChatGPT:** enable Developer mode, then create an app/connector with the URL.

Then ask, for example: *"Make me a short course on photosynthesis."*

## MCP tools

| Tool | Does |
|---|---|
| `create_course` | Draft course from a title and lesson outline. Returns `courseId` and a private `editToken`. |
| `add_lesson` | Adds or replaces one lesson's cards. Cards are validated; errors explain what to fix. |
| `publish_course` | Checks every lesson has cards, publishes, returns the link and thumbnail URL, and shows the **course card** in the chat (thumbnail, lessons, Open course button) in hosts that support MCP Apps. |
| `get_course` | Loads a course to continue or edit it. |

The server also sends instructions telling the AI how to build a good course (ask about level/length/language first, mix explanations and questions, add diagrams, keep it short).

Notes:

- Only the edit token can change a course; the database stores its SHA-256 hash.
- Calls from ChatGPT and Claude come from the platforms' servers, so per-IP limits would throttle everyone together. Phase 2 uses a global hourly cap (`MAX_COURSES_PER_HOUR`); per-user limits come with accounts in Phase 5.
- The course card loads the MCP Apps client from `/mcp-app/sdk.js` on this site. `npm run dev` / `npm run build` copy it there from `@modelcontextprotocol/ext-apps` (see `scripts/copy-mcp-app-sdk.mjs`).
- Thumbnails are drawn with HarfBuzz (text shaped into glyph outlines) and rasterized with resvg, so Bangla, Devanagari and Arabic render correctly.

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (schema, grading, spaced repetition); set `TEST_DATABASE_URL` to also test the store against Postgres |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## How it's built

- **Next.js 16** (App Router) + TypeScript, plain CSS with design tokens from the logo.
- **zod** for the course format, **ts-fsrs** for spaced repetition.
- **mcp-handler** (MCP SDK v2) for the MCP endpoint, **postgres.js** for Supabase Postgres, **aws4fetch** for Supabase Storage.
- **harfbuzzjs** + **@resvg/resvg-js** for thumbnails.
- Fonts are self-hosted from npm (`@fontsource-variable/*`): Plus Jakarta Sans and Inter for the interface, with Noto Sans Bengali, Devanagari and Arabic as fallbacks for course content. Browsers only download a script's font when a page uses it.

```
src/
  app/
    page.tsx              Landing page with sample courses
    c/[id]/page.tsx       Course player route (link preview metadata on the server)
    api/mcp/route.ts      MCP endpoint
    api/thumbnail/[id]/   Thumbnail PNG
    layout.tsx, globals.css
  components/player/
    Player.tsx            Views: home → lesson → lesson complete, review → review complete
    CourseHome.tsx        Course card, today's review, lesson path
    Runner.tsx            Runs a list of cards: check, feedback, wrong answers come back at the end
    Cards.tsx             Explain, multiple choice, fill in the blank, put in order
    InteractiveCards.tsx  True/false, select all, match pairs, tap the picture, slider simulation
    DoneScreen.tsx, Rich.tsx (safe mini-markdown, SVG via <img>)
  lib/
    schema.ts             THE course format (v1). The MCP server will validate against this.
    grading.ts            Answer state, canCheck, isCorrect, correct-answer text
    expr.ts               Safe formula parser for simulations (no eval)
    srs.ts                FSRS scheduling (shortest gap: 1 day)
    progress.ts           Progress in localStorage (moves to the server in Phase 5)
    server/
      mcp.ts              Tool definitions and the AI's instructions
      courseCard.ts       The in-chat course card (MCP App HTML)
      store.ts            Create / add lesson / publish / load, edit tokens, limits
      courses.ts          Course lookup for pages (samples, then database)
      db.ts, storage.ts   Postgres and Supabase Storage clients
      thumbnail.ts, textpath.ts   Thumbnail drawing
    i18n.ts               Every interface string
    text.ts               Answer normalization, stable shuffles
  content/                Sample courses
assets/                   Fonts (OFL) and logo used for thumbnails
supabase/migrations/      SQL to run in Supabase
```

## Course format (v1)

A course is JSON validated by `src/lib/schema.ts`:

```jsonc
{
  "schemaVersion": 1,
  "id": "photosynthesis-en",
  "title": "Photosynthesis: How Plants Make Food",
  "language": "en",              // BCP-47; "ar", "he", "fa"… switch to right-to-left
  "color": "#1F6F3A",
  "lessons": [{
    "id": "l1",
    "title": "The leaf’s kitchen",
    "cards": [
      { "type": "explain", "title": "…", "body": "Light **markdown**", "svg": "<svg…>", "note": "Remember box" },
      { "type": "mcq", "question": "…", "options": ["…"], "answer": 1, "explanation": "…" },
      { "type": "fill", "text": "Takes in ___ and gives off ___.", "blanks": [{ "answers": ["CO₂", "CO2"] }, { "answers": ["O₂"] }], "bank": ["O₂", "CO₂", "N₂"] },
      { "type": "order", "prompt": "…", "items": ["first", "second", "third"] }
    ]
  }]
}
```

Rules worth knowing:

- `fill.text` needs one `___` per entry in `blanks`; with a `bank`, every blank needs an accepted answer in the bank.
- `order.items` are written in the **correct** order; the player shuffles them.
- Typed answers are matched after normalization (case, spacing, trailing punctuation, `CO₂` = `CO2`, Bengali/Devanagari/Arabic digits).
- SVG is shown through `<img>`, so scripts inside can never run.

## Learning model

- In a lesson, a wrong answer shows the correct one and comes back at the end of the lesson.
- When a lesson ends, each question enters spaced repetition: missed ones come back tomorrow, the rest after a few days, with gaps growing as memory gets stronger (FSRS).
- XP: 10 per first-try correct answer and 10 per finished lesson; 5 per remembered review card. The streak grows on each day with a lesson or review.
