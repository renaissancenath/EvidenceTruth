# Measured accuracy

SciFact (expert-written scientific claims), **official dev split, 300 claims**, never used for training or tuning.
Claim-level labels: supported, contradicted, not enough information. Same protocol for every model
(`docs/plans/MODEL_BENCHMARK.md`): thresholds chosen on training data only, dev scored once.

"Cited abstract": the model is given the abstracts the claim cites. "Search": it must find them among all 5,183
abstracts (BM25 top 3; the right abstract is in the top 3 for 83.5% of claims).

All rows below come from one notebook run on a free Google Colab T4 GPU on 25 Nov 2026 (commit `4419890`); its
summary table is reproduced as a screenshot in the README.

## Cited abstract
| Verifier | Accuracy | Macro-F1 | F1 supported | F1 contradicted | F1 not enough info |
|---|---|---|---|---|---|
| Majority class (baseline) | | 0.195 | | | |
| Word matching (lexical-v2) | 55.3% | 0.428 | 0.576 | 0.056 | 0.652 |
| Learned v2 (word vectors, own protocol) | 57.0% | 0.516 | 0.574 | 0.259 | 0.717 |
| DeBERTa-v3-base, 3 selected sentences | 61.3% | 0.609 | 0.543 | 0.642 | 0.641 |
| DeBERTa-v3-large, whole abstract | 67.0% | 0.670 | 0.667 | **0.672** | 0.672 |
| **MultiVerS (fever_sci)** | **72.7%** | **0.670** | **0.759** | 0.462 | **0.790** |

## Search over all abstracts
| Verifier | Accuracy | Macro-F1 | F1 supported | F1 contradicted | F1 not enough info |
|---|---|---|---|---|---|
| Word matching (lexical-v2) | 52.3% | 0.416 | 0.561 | 0.081 | 0.607 |
| DeBERTa-v3-base, 3 selected sentences | 54.3% | 0.539 | 0.497 | 0.558 | 0.564 |
| DeBERTa-v3-large, whole abstract | 52.7% | 0.527 | 0.549 | 0.537 | 0.495 |
| **MultiVerS (fever_sci)** | **70.0%** | **0.640** | **0.750** | 0.422 | **0.748** |

## Models
- **MultiVerS** (Wadden et al., 2022; code MIT): Longformer-large reading claim and whole abstract together, predicting
  the label and the evidence sentences. The `fever_sci` checkpoint is trained on FEVER, PubMedQA and Evidence Inference,
  **never on SciFact**. The released `scifact` checkpoint was trained on SciFact dev as well, so it is not used.
- **DeBERTa-v3** cross-encoders trained for natural language inference (`cross-encoder/nli-deberta-v3-base`, `-large`),
  used zero-shot.
- Word matching and the learned verifiers are this project's own.

## What the numbers say
- MultiVerS is the most accurate overall and holds up when it has to find the abstract itself (72.7% to 70.0%), because
  it reads the whole abstract with a long-context model trained for this task.
- DeBERTa-v3-large is the best at **contradictions** (F1 0.672 against MultiVerS's 0.462). The two models make different
  mistakes, which is what an ensemble can use.
- Picking the three most relevant sentences helps the smaller DeBERTa model (0.499 to 0.609 macro-F1).
