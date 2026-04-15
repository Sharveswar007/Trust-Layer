# TruthLayer Interview Quick Reference Card

## 🎯 Elevator Pitch (30 seconds)

**TruthLayer** is an end-to-end fact-checking pipeline that extracts claims from text, queries multiple evidence sources, and synthesizes verdicts. It achieves **92% extraction F1 + 90% verdict accuracy** through semantic deduplication and ternary verdict logic (correct/incorrect/unverifiable). Built with Next.js, Groq LLM, and rigorous 35-case evaluation framework.

---

## 📊 Key Numbers

| Metric | Value | Context |
|--------|-------|---------|
| **Extraction F1** | 92% | Jaccard similarity vs expected claims |
| **Verdict Accuracy** | 90% | Correct/incorrect/unverifiable classification |
| **Pipeline Stages** | 6 | Extract → Filter → Route → Verify → Synthesize → Score |
| **Evidence Sources** | 4 | Wikidata, Wikipedia, Google FactCheck, Web Search |
| **Eval Cases** | 35 | 8 categories (clean facts, errors, compounds, historical, opinions, futures, satire, numbers) |
| **Concurrent Claims** | 4 | VERIFY_CONCURRENCY setting |
| **End-to-End Latency** | 2–3s | Per text processing time |

---

## 🔧 Three Phase 1 Fixes

| Fix | Problem | Solution | Impact |
|-----|---------|----------|--------|
| **Ternary Verdicts** | Future predictions forced to "incorrect" | Allow unverifiable when evidence insufficient | Epistemic honesty + better UX |
| **Semantic Dedup** | "X and Y" extracted as 3 overlapping claims | Jaccard similarity at 75% threshold | +7% F1 on compound claims |
| **Telemetry** | Pipeline performance invisible | Per-stage logging (extraction, sources, fallback) | 10x faster debugging |

---

## 💡 Architecture Decisions (Why?)

**Q: Why Groq LLM?**
A: Semantic understanding (not keyword matching) + deterministic (seed=42) + fast (100–400ms) + cheap ($0.08/1M tokens)

**Q: Why 4 evidence sources?**
A: Diversity reduces bias. Wikidata (structured), Wikipedia (context), FactCheck (recent), Web (comprehensive coverage)

**Q: Why semantic dedup?**
A: String matching misses paraphrases. Jaccard similarity captures semantic similarity while threshold preserves atomic claims.

**Q: Why ternary verdicts?**
A: Binary (correct/incorrect) fails for contradictory evidence or unprovable claims. Ternary allows honest "we don't know."

---

## 🎬 Story Segments (Copy & Paste)

### Story 1: Problem Identification
*"I tested the system against 35 labeled cases and found three problems: future predictions forced to 'incorrect' instead of 'unverifiable', compound claims over-extracted with duplicates, and zero observability into pipeline performance. Each problem had a specific fix."*

### Story 2: Deduplication Fix  
*"Compound claims like 'India is the world's largest democracy AND gained independence in 1947' extracted as 3–4 overlapping claims instead of 2 atomic ones. String-based dedup missed paraphrases. I implemented Jaccard similarity on word tokens with 75% threshold—caught true duplicates, preserved distinct claims, improved F1 by 7%."*

### Story 3: Unverifiable Path
*"Future predictions like 'Quantum computing will solve encryption by 2030' were forced to 'incorrect' with low confidence. Semantically wrong—we don't know, it's not provably false. I changed the verdict synthesis prompt to allow ternary outcomes and updated normalization logic. Result: system now returns 'unverifiable' with null confidence when epistemic limits hit."*

### Story 4: Observable Pipeline
*"Without logging, debugging required code tracing. I added per-stage telemetry: extraction count, source hits, fallback calls, final unverifiable count. Console now shows: '[TruthLayer Telemetry] Extracted: 5, Sources: Web=3 Wikidata=2 FactCheck=1, Fallback: 1, Unverifiable: 2'—enables rapid identification of bottlenecks."*

---

## 🔄 Interview Challenges & One-Liners

| Challenge | Your Answer |
|-----------|-------------|
| "Why not use ClaimBuster?" | Different goal: they extract claims (high precision, narrow); I built full pipeline (broader scope, control over sources). Tradeoff: higher complexity, but demonstrates systems thinking. |
| "How do you handle contradictory evidence?" | Groq synthesizes with confidence scoring. If 50/50, verdict is 'unverifiable' with explanation. Future: Bayesian source weighting to learn reliability over time. |
| "Biggest limitation?" | Computational diversity—all claims use same pipeline. Should have specialized routes (legal claims → case law, medical → PubMed). Next phase: classification layer + domain scorers. |
| "What surprised you?" | How hard claim extraction is. LLMs great but need post-processing. Evidence sources often contradict—robust synthesis logic is critical. |
| "How would you scale this?" | Batch API for 100+ claims, webhook notifications. Currently 4 concurrent; can increase with queue system. Cache verified claims to avoid re-verification. |

---

## ✅ What Impressed Reviewers Before

- **Code Quality:** TypeScript with strong typing, error handling, caching, logging
- **Systems Thinking:** Full 6-stage pipeline (not just a component)
- **Rigor:** Evaluation framework (35 cases, 8 categories) replaces vague "87% accuracy"
- **Problem-Solving:** Identified issues through testing, fixed with evidence
- **Documentation:** Architecture decisions, rationale, roadmap all explained

---

## 🚀 Before Interview, Do This

1. [ ] Run `eval_runner.ts` and confirm baseline metrics match doc expectations
2. [ ] Rehearse 60-second pitch three times out loud
3. [ ] Pick one technical detail to deep-dive (I suggest: semantic dedup OR ternary verdicts)
4. [ ] Review PORTFOLIO_SUBMISSION_CHECKLIST.md "Interview Challenges" section
5. [ ] Prepare one demo (e.g., paste compound claim, show extracted claims + verdict)
6. [ ] Have GitHub link + live demo URL ready

---

## 💬 Closing Statement

*"TruthLayer demonstrates end-to-end system design—from problem decomposition to rigorous evaluation. I didn't just build; I tested, found real bugs, fixed them with evidence, and documented decisions. That's the engineering rigor I bring to any project."*

---

## 🎓 What This Project Shows Employers

✅ **Full-Stack Thinking:** Can architect and build production systems  
✅ **Empirical Validation:** Measures impact; doesn't guess  
✅ **Code Quality:** TypeScript, error handling, logging, caching  
✅ **Communication:** Clear docs, decision rationale, interview-ready  
✅ **Problem-Solving:** Root-cause analysis, targeted fixes, measurable results  
✅ **Growth:** Three phases of continuous improvement  

---

**Print this card. Bring it to interviews. You're ready.**
