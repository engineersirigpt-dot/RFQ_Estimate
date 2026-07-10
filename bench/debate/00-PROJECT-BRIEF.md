# Project Brief — RFQ Auto-Fill from Dielines (for an external AI debate partner)

> **Purpose of this file:** context so an external model (GPT) can engage in a rigorous design debate with Claude about the *best method to auto-generate packaging RFQs from dieline images*. Read this once, then read `debate-log.md`. You (GPT) are invited to **disagree and find flaws** — the goal is the best method, not consensus.

## The system
"Estimate-Packaging" — a Node.js + Express web app that quotes folding-carton/packaging jobs. An AI endpoint (`/ai/parse-spec`, using **Claude Opus 4.8 vision**) takes a customer's **dieline artwork image** (or spec text) and auto-fills a quotation form:

- **box_template** — the box construction shape, one of **12 templates** (see below)
- **dimensions** — W × L × H (mm)
- paper type/gram, colors (out/in), coatings, foil, quantities, deliveries, etc.

A human **always reviews** before the quote is used. For dielines, `box_template_id` is **always flagged "uncertain"** so a human confirms the shape.

## The 12 box templates (shape classes)
1 Reverse Tuck End · 2 Straight Tuck End · 3 Snap-Lock Bottom · 4 Tuck-Top Auto-Bottom · 5 Tray · 6 Frame-Vue Tray · 7 Bento (tray+lid) · 8 Gable (handle) · 9 Sleeve · 10 Pillow · 11 Seal End · **12 Custom** (anything not matching 1–11).

**The hard part = the "tuck family" (1 vs 2 vs 4).** They differ only in subtle bottom-flap geometry (simple tuck flap vs glued diagonal crash-lock). **Custom (12)** = any box with a non-standard feature (die-cut window, open cover/wrap, scalloped edge, >4 body panels, handle, etc.).

## What we established this week (real experiments — treat as ground truth)
1. **Claude reads dimensions/text/colors reliably.** These are the fields that drive pricing. CLIP/CV **cannot** read dimensions — only Claude (vision+OCR) can.
2. **Claude has a SYSTEMATIC error on the tuck family.** A known Reverse-Tuck box ("Happy Jim") is classified as Auto-Bottom(4) **5/5 times** through the production prompt — stable, not random. Two rounds of prompt rules + a self-check item did **not** fix it. In an *isolated* focused prompt (only templates 1 vs 4, "look at the bottom") Claude answered 1 with 88% confidence — so the model *can* see it, but the full 12-way production prompt biases it to 4.
3. **Opus 4.8 forbids `temperature`/`top_p`** (locked) → cannot reduce sampling randomness directly.
4. **Majority voting only fixes VARIANCE, not systematic error.** Happy Jim is systematic (5/5 same wrong answer) → voting won't help it.
5. **Custom(12) detection via feature rules works well** — after adding rules for window/cutout, open cover/wrap, scalloped edge, >4 panels: **3/3** custom boxes correctly caught (Applaws, D3D, GENT).
6. **A free local CV path exists.** CLIP image embeddings (Transformers.js, runs on CPU, **$0 inference**) + a classifier over **8,349 human-labeled (dieline image → template)** pairs pulled from the production DB.
   - With only **606** training examples: kNN = **43% exact 12-way**, **75% custom-vs-standard binary**. A trained logistic head **overfit** (worse) at that size.
   - We are **currently embedding a larger set (~400/template, ~2,400 images)** to retest. Embedding is cached, incremental.
7. **Class imbalance** in the 8,349: 12=4313, 1=1267, 3=930, 4=847, 2=620, 11=210, 9=116, rare (5,7,8,10) each <20.
8. **Cost:** 1 Claude vision call per dieline ≈ a few cents (production is cheap — the expensive part was our *testing* harness that re-sent 76 few-shot images). CV inference = free.

## Constraints
- **Read-only debate.** No code changes, no DB access, no running the server, no external calls happen as a result of this debate. Any change proposed must be approved by the project owner first.
- The owner is responsible ONLY for the AI zone (parse/auto-fill). The calc engine, the manual form, and the DB belong to teammates and must not be touched.

## What Claude's internal debate already converged on (attack this!)
Three internal "teams" (Claude-only / CV-classifier / Hybrid-ensemble) debated and converged:
- **Claude stays the core extractor** (dimensions + all fields + a shape guess) — non-negotiable, CV can't replace it.
- **Add CV as an independent SECOND OPINION on shape** — not as an auto-decider, but as a **disagreement flag**: when Claude-shape ≠ CV-shape, mark that box for focused human review. This turns "review every dieline equally" into **triage** (rubber-stamp the agreeing majority, scrutinize the disagreeing minority) — and it is the *only* mechanism that surfaces Claude's systematic Happy-Jim error.
- **Don't pick an architecture by belief — let held-out numbers decide.** Concrete kill-criteria:
  - If CV tuck-family (1/2/4) accuracy < 70% exact **or** doesn't beat Claude by ≥15 points → drop CV shape, ship Claude-only.
  - If CV custom-vs-standard binary reaches ~90%+ → trust CV to decide shape.
  - If "agreement predicts correctness" holds on held-out → ship the full ensemble; otherwise collapse to whichever single system the data favors.

**GPT: your job is to challenge this. Is there a materially better method we're missing? Are our assumptions or kill-criteria wrong? Where would this fail in production?**
