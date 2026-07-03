---
name: expert-research
description: >
  Multi-step web research that finds first-hand, immediately actionable advice from
  operators, founders, and practitioners who have actually done the thing — and strictly
  rejects SEO content-farm fluff. Use this whenever the user wants to learn how to do
  something at work or figure out how to implement something: questions like "how do I…",
  "how should we…", "what's the best way to…", "how do other companies…" about metrics/KPIs,
  sales, marketing, hiring, engineering management, product, design, fundraising, pricing,
  running meetings, org design, or general company/career advice. Also trigger when the user
  asks for "essays", "articles", "resources", "reading", or "what the best people do" on a
  topic. Trigger even if the user never says the word "research" — a practical how-do-I
  question about work is enough.
---

# Expert Research

Find and synthesize advice the way a great internal knowledge base would: written by
people who have actually done the thing, describing exactly what they did in a situation
like the user's, with steps the user can act on today. The bar is "would a top operator
forward this to a friend," not "does this rank on Google." Most search results will fail
this bar. That is expected — reject them and keep digging.

## Why this exists

Google (and generic AI search) optimizes for pages that are optimized for Google. The
result is fluffy listicles written by content marketers who have never done the thing.
The best material — a founder's postmortem, a VP's internal memo turned blog post, a
practitioner's "here's exactly how we did it" essay — is usually buried, on a personal
blog, in a newsletter archive, or in a talk transcript. This skill's job is to find that
material specifically, and to refuse to pad the answer with anything less.

## Workflow

Work through these steps in order. Do not skip the triage step — it is the entire point
of the skill.

### Step 1: Pin down the user's actual situation

Advice quality depends on context: company stage, team size, the user's role, and what
they've already tried. Extract these from the conversation. If one missing detail would
materially change which advice applies (e.g., "define KPIs" means something different at
a 4-person pre-revenue startup vs. a 200-person Series C company), ask ONE clarifying
question before searching. Otherwise, state your assumption in one line and proceed —
don't interrogate the user.

### Step 2: Identify who would have actually done this

Before writing any search query, spend a moment answering: *what kind of person has
lived through this exact problem and written honestly about it?* Examples:

- Defining startup KPIs → founders/CEOs who wrote about their metrics reviews; growth
  leaders at well-known companies; investors who publish operating guides drawn from
  portfolio work
- Running an all-hands → CEOs and Heads of People who documented their formats and what
  flopped
- Measuring feature success → product leaders and data-science practitioners writing
  about how their team actually instrumented and reviewed launches
- Engineering process questions → engineering managers/CTOs writing postmortems and
  "how we work" docs

This step shapes the queries: you are hunting for **people and first-person accounts**,
not for topic keywords.

### Step 3: Search in multiple rounds (this is multi-step research, not one query)

Run at least 2–3 distinct search rounds; complex or comparative topics may need 5–8.
Vary the angle each round rather than rewording the same query:

1. **First-person framing round.** Use phrasings that surface practitioner writing:
   "how we [did X]", "[topic] lessons learned", "[topic] postmortem", "what I learned
   [doing X]", "[topic] at [well-known company]".
2. **Named-expert round.** If Step 2 surfaced likely experts or companies known for
   the practice, search for their writing directly: "[person/company] [topic] essay".
3. **Venue round.** Search where operators publish: personal blogs, engineering blogs,
   founder newsletters, conference talk transcripts, YC's public library, First Round
   Review-style interview pieces. Query by venue + topic when the general web is noisy.
4. **Gap-filling round.** After triage (Step 4), if a sub-question is still uncovered,
   search for that sub-question specifically rather than re-searching the whole topic.

Fetch the full text of promising results with web_fetch — snippets are not enough to
judge quality or extract concrete steps.

### Step 4: Triage ruthlessly — accept or reject every source

Apply this filter to every candidate before it can inform the answer.

**ACCEPT only if the source clears all three:**

1. **A real, named practitioner wrote it** — a founder, operator, executive, or expert
   with verifiable experience doing the thing. A byline like "The [Company] Team" or
   "Staff Writer" fails.
2. **It's first-hand.** The author describes what *they* did, with specifics: numbers,
   timelines, mistakes, what they'd change. "Companies should consider…" fails;
   "We tried X for two quarters, it failed because Y, so we switched to Z" passes.
3. **It has immediate action points.** A reader could do something differently tomorrow
   because of it.

**REJECT on sight (do not cite, do not let it shape the answer):**

- SEO listicles and content-farm posts ("Top 12 Ways to…", "Ultimate Guide to…" with no
  author expertise)
- Vendor content marketing whose real purpose is selling the vendor's tool, unless the
  specific piece is a genuine practitioner account
- Aggregator rewrites of other people's advice, AI-generated slop, and posts padded to
  hit a word count
- Anything generic enough that it could have been written without ever doing the thing

When in doubt, check the author: search their name if needed. Two great sources beat
ten mediocre ones. If a search round returns only rejects, say nothing about them —
just run a better round.

### Step 5: Synthesize into an actionable answer

Read the accepted sources fully, then write the answer in this shape (prose, not a wall
of bullets):

1. **Bottom line first** — 2–4 sentences: what the best practitioners converge on, and
   the single most important thing for the user's specific situation.
2. **What the experts actually did** — for each source (typically 3–6), one short
   passage: who the person is and why they're credible (one line), what they did, and
   the concrete, do-it-tomorrow takeaway. Attribute clearly and link. Paraphrase in your
   own words; keep any direct quote under 15 words and use at most one per source.
3. **Where they disagree** — if the experts diverge, say so and explain which approach
   fits which situation, rather than papering over the conflict.
4. **Your move** — a short, ordered set of next steps tailored to the user's context
   from Step 1. This is the part the user will actually use; make every step something
   they can start this week.

### Quality bar and honesty rules

- Never inflate credentials or invent an author's background. If you can't verify that
  the author has done the thing, either verify with another search or drop the source.
- If the well is genuinely dry — few first-hand accounts exist on this topic — say so
  explicitly and give the best of what exists, clearly labeled. Do not lower the bar and
  quietly pass off SEO content as expert advice.
- Cite every specific claim to its source. The user should be able to click through and
  read every piece you drew from.
- Do not summarize any single source so thoroughly that reading it becomes unnecessary;
  extract the actionable core and point the user to the original for the full story.

## Scope

Works for anything from sales to marketing to engineering to product to design to
general company advice. It is NOT for academic literature reviews, breaking news, or
questions with a single factual answer — handle those normally without this skill.
