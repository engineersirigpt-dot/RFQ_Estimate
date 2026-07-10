# Debate Log — Claude ⇄ GPT: "Best method to auto-generate RFQs from dielines"

**Format:** Rounds alternate. Claude writes a message → the human relays it to GPT → GPT's reply is pasted back → Claude reads and rebuts. Every round is appended here as a permanent log.

**How to use (for the human):**
1. First time: give GPT `00-PROJECT-BRIEF.md` **and** the "CLAUDE → GPT · Round 1" message below.
2. Paste GPT's reply back to Claude (just say "ข้อความมาแล้ว:" + the text).
3. Claude appends GPT's reply + writes the next round here. Repeat.

**Ground rule for both models:** the goal is the *best method*, not winning. Concede real points. No code/DB changes result from this debate.

---

## CLAUDE → GPT · Round 1 (opening)

Hi GPT. We're designing the AI that turns a customer's **dieline artwork image** into a filled packaging quote (see `00-PROJECT-BRIEF.md`). I'll state where our internal analysis landed, then ask you to break it.

**Our current best method:** Claude Opus 4.8 vision stays the single extractor (dimensions + all fields + a shape guess), because only it can read the dimension callouts that drive pricing — a pure-CV approach is a non-starter. On top of that, we add a **free local CLIP-based shape classifier** trained on 8,349 human-labeled dielines, used **not as a decider but as a disagreement-flagger**: when Claude's shape ≠ CV's shape, we escalate that box for focused human review. The whole thing is **empirically gated** — if the classifier can't beat Claude on the tuck family (Templates 1/2/4) by a clear margin on held-out data, we don't ship it.

**The central problem I want you to attack:** Claude makes a *systematic* (not random) error on the tuck family. A real Reverse-Tuck box gets called Auto-Bottom(4) 5 times out of 5 through our production prompt. Adding prompt rules and a self-check did nothing. Interestingly, in an *isolated* prompt (only templates 1 vs 4, "examine the bottom") Claude gets it right at 88% confidence — but the full 12-way production prompt stably biases it to 4. Temperature is locked on Opus 4.8, and voting only fixes variance, not this.

**Four challenges for you — please disagree hard where you can:**

1. **Is our "prompt is ceilinged" conclusion premature?** We added rules to the existing 12-way single-shot prompt. Would a *fundamentally different* prompt architecture actually fix the tuck-family systematic error — e.g., a **two-stage** approach where Claude first outputs a structured description of ONLY the bottom-flap geometry (diagonal creases? glue? symmetric tuck?) and a **deterministic code rule** maps that to 1/2/4, removing Claude's freedom to "pick" the template? Or a dedicated binary shape-only call per confusable pair? Where would that break?

2. **Does training on the 8,349 labels just reproduce human label noise?** Those labels are how busy engineers actually tagged boxes — they may embed the same confusions and shop conventions, not ground truth. If a classifier fit to them "beats Claude," is it learning correctness or just matching a noisy oracle? How would you separate the two, and does it even matter if the goal is to match what the humans want?

3. **Is the disagreement-flagger genuinely worth a second system,** given box_template is *already* flagged uncertain 100% of the time and human-reviewed? Our claim: a constant flag carries zero information; a disagreement signal ranks boxes by risk (rubber-stamp the ~70% agreements, scrutinize the ~30% disagreements). Is that a real throughput win, or are we fooling ourselves — especially when both models could be wrong the *same* way (correlated errors) and agreement gives false comfort?

4. **What are we missing entirely?** Outside our {Claude-only, CV-classifier, Hybrid} frame — is there a better idea? Candidates we've considered but not committed to: fine-tuning a small vision model / LoRA on the 8,349; classical CV to extract the dieline's fold-line geometry (Hough line angles, panel counts) and rule on that directly; OCR of the dimension callouts to *derive* construction; or a verbalized-confidence rubric to get calibrated uncertainty from Claude. Which of these would you prioritize, and what would you throw out?

Be concrete and skeptical. If our converged plan is basically right, say which part is weakest. If it's wrong, tell me the better method.

— Claude

---

## GPT → CLAUDE · Round 1 (reply)

> _(paste GPT's reply here)_
