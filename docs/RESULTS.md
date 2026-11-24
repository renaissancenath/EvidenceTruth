# Measured accuracy

SciFact (expert-written scientific claims), **official dev split, 300 claims**, never used for training or tuning.
Claim-level labels: supported, contradicted, not enough information. Protocol: `docs/plans/MODEL_BENCHMARK.md`.

"Cited abstract" gives the model the abstracts the claim cites; "search" retrieves the top 3 of all 5,183 abstracts
with BM25 (the right abstract is in the top 3 for 83.5% of claims).

## Cited abstract
| Verifier | Accuracy | Macro-F1 | F1 supported | F1 contradicted | F1 not enough info | Source |
|---|---|---|---|---|---|---|
| Majority class (baseline) | | 0.195 | | | | |
| Word matching (lexical-v2) | 55.3% | 0.428 | 0.576 | 0.056 | 0.652 | run `20261123-110603` |
| Learned v2 (word vectors), train90 protocol | 50.3% | 0.438 | 0.427 | 0.236 | 0.651 | run `20261123-191347` |
| DeBERTa-v3-base, zero-shot, whole abstract | 50.7% | 0.465 | 0.286 | 0.504 | 0.604 | Colab T4, 24 Nov 2026 |
| DeBERTa-v3-base, zero-shot, 3 sentences (MiniLM reranker) | 60.0% | 0.595 | 0.518 | 0.636 | 0.631 | Colab T4, 24 Nov 2026 |
| **DeBERTa-v3-large, zero-shot, whole abstract** | **65.0%** | **0.652** | 0.598 | 0.688 | 0.669 | Colab T4, 24 Nov 2026 |

## Search over all abstracts
| Verifier | Accuracy | Macro-F1 | F1 supported | F1 contradicted | F1 not enough info | Source |
|---|---|---|---|---|---|---|
| Word matching (lexical-v2) | 52.3% | 0.416 | 0.561 | 0.081 | 0.607 | run `20261123-111018` |
| Learned v2, train90 protocol | 44.7% | 0.422 | 0.509 | 0.281 | 0.475 | run `20261123-191445` |
| DeBERTa-v3-base, zero-shot | 46.7% | 0.439 | 0.295 | 0.467 | 0.554 | Colab T4, 24 Nov 2026 |
| **DeBERTa-v3-large, zero-shot** | **54.3%** | **0.542** | 0.508 | 0.549 | 0.568 | Colab T4, 24 Nov 2026 |

Colab rows: zero-shot cross-encoders (`cross-encoder/nli-deberta-v3-base`, `-large`), threshold chosen on official
train only. Their full output, including confusion matrices, is saved in the notebook at commit `aa630b8`; the run
folders will be added when the next notebook run is downloaded.

## What the numbers say
- Meaning-based models are the step change: DeBERTa-v3-large lifts contradiction F1 from 0.06 to 0.69.
- Finding the right abstract is now the largest loss: the same model drops from 65.0% to 54.3% when it has to search.
- Choosing the few most relevant sentences helps the base model a lot (0.465 to 0.595 macro-F1); the large model with
  the same selection is the next run, followed by MultiVerS (`fever_sci`, never trained on SciFact) and fine-tuning on
  SciFact train with extra health-claim data.
- 80% is the target. No configuration has reached it yet.
