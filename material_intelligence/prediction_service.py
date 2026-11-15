"""Reusable inference service with explicit domain-of-validity gates."""
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable
import numpy as np

@dataclass
class PredictionResult:
    predicted_class: str
    class_scores: Dict[str, float]
    domain: Dict[str, Any]
    confidence_label: str
    usable_for_optimizer: bool
    limitations: list

    def to_dict(self):
        return asdict(self)

class PredictionService:
    def __init__(self, model, processor, classes: Iterable[str],
                 adverse_classes: Iterable[str], domain_z_limit: float = 3.0):
        self.model = model
        self.processor = processor
        self.classes = [str(x) for x in classes]
        self.adverse_classes = {str(x) for x in adverse_classes}
        self.domain_z_limit = float(domain_z_limit)
        if not self.adverse_classes.issubset(set(self.classes)):
            raise ValueError("Every adverse class must exist in model classes.")

    def predict(self, records):
        import pandas as pd
        frame = records.copy() if isinstance(records, pd.DataFrame) else pd.DataFrame(records)
        required = list(__import__("config").NUMERIC_FEATURES) + list(__import__("config").CATEGORICAL_FEATURES)
        missing = [c for c in required if c not in frame.columns]
        if missing:
            raise ValueError(f"Missing model features: {missing}")
        domain = self.processor.domain_report(frame, self.domain_z_limit)
        X = self.processor.transform(frame)
        raw = np.asarray(self.model.predict_proba(X), dtype=float)
        if raw.ndim != 2 or raw.shape != (len(frame), len(self.classes)):
            raise ValueError("Model probability output has unexpected dimensions.")
        results = []
        for i, row in enumerate(raw):
            valid = np.isfinite(row).all() and np.all(row >= 0) and abs(float(row.sum()) - 1.0) <= 1e-3
            scores = {label: float(row[j]) for j, label in enumerate(self.classes)} if valid else {}
            pred = self.classes[int(np.argmax(row))] if valid else "unknown"
            row_domain = {"in_domain": domain["in_domain"], "issues": domain["issues"],
                          "warning": domain["warning"]}
            usable = bool(valid and domain["in_domain"])
            results.append(PredictionResult(
                predicted_class=pred, class_scores=scores, domain=row_domain,
                confidence_label="uncalibrated_model_scores" if valid else "invalid_model_output",
                usable_for_optimizer=usable,
                limitations=[
                    "Softmax scores are not calibrated probabilities or causal effects.",
                    "Out-of-domain inputs are withheld from optimizer screening.",
                    "A prediction is not a safety determination or operating instruction."
                ] + ([] if domain["in_domain"] else ["Input is outside the fitted training domain."])
            ).to_dict())
        return results
