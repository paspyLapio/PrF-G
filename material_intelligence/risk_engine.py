"""Explainable variable anomaly scoring and crew alerts.

Historical material profiles are descriptive references, not safety limits.
The scores are operational anomaly labels, not probabilities of harm.
"""
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, Iterable, Mapping, Optional
import math

import numpy as np

NOMINAL = 1.0
REDUCED_UNDEFINED = 0.5
LOW = 0.0


def classify_variable(value, lower_limit=None, upper_limit=None,
                      quality_ok=True, margin_fraction=0.10):
    """Return the requested 1.0 / 0.5 / 0.0 variable status."""
    if not quality_ok or value is None:
        return {"score": REDUCED_UNDEFINED, "level": "Reduced / Undefined",
                "reason": "Measurement or reference profile is missing or unreliable"}
    try:
        value = float(value)
        lower_limit = float(lower_limit)
        upper_limit = float(upper_limit)
        margin_fraction = float(margin_fraction)
    except (TypeError, ValueError):
        return {"score": REDUCED_UNDEFINED, "level": "Reduced / Undefined",
                "reason": "Measurement or reference range is not numeric"}
    if not all(math.isfinite(x) for x in (value, lower_limit, upper_limit, margin_fraction)):
        return {"score": REDUCED_UNDEFINED, "level": "Reduced / Undefined",
                "reason": "Measurement or reference range is not finite"}
    if lower_limit >= upper_limit or not 0.0 <= margin_fraction < 0.5:
        return {"score": REDUCED_UNDEFINED, "level": "Reduced / Undefined",
                "reason": "Reference range or boundary margin is invalid"}
    if value < lower_limit or value > upper_limit:
        return {"score": LOW, "level": "Low",
                "reason": "Measurement is outside the accepted reference range"}
    margin = (upper_limit - lower_limit) * margin_fraction
    if value - lower_limit <= margin or upper_limit - value <= margin:
        return {"score": REDUCED_UNDEFINED, "level": "Reduced / Undefined",
                "reason": "Measurement is close to a reference limit"}
    return {"score": NOMINAL, "level": "Nominal",
            "reason": "Measurement is within the nominal reference range"}


@dataclass
class RiskAssessment:
    status: str
    risk_score: Optional[float]
    predicted_adverse_probability: Optional[float]
    anomaly_count: int
    reasons: list
    limitations: list
    variable_assessments: Dict[str, Any] = field(default_factory=dict)
    crew_alerts: list = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


def _finite_probability(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) and 0.0 <= value <= 1.0 else None


class RiskEngine:
    """Assess variable anomalies and optionally combine model probabilities."""
    def __init__(self, adverse_classes: Iterable[str] = (), anomaly_z_threshold=2.0,
                 margin_fraction=0.10):
        self.adverse_classes = {str(x) for x in adverse_classes}
        self.anomaly_z_threshold = float(anomaly_z_threshold)
        self.margin_fraction = float(margin_fraction)

    def assess(self, probabilities: Optional[Mapping[str, float]] = None,
               anomaly_result: Optional[Mapping[str, Any]] = None,
               comparability_class: Optional[str] = None) -> RiskAssessment:
        reasons, limitations = [], []
        anomaly_result = anomaly_result or {}
        values = anomaly_result.get("values", {})
        ranges = anomaly_result.get("reference_ranges", {})
        quality = anomaly_result.get("quality_ok", {})
        quality_reasons = anomaly_result.get("quality_reasons", {})
        variable_assessments, crew_alerts = {}, []

        if isinstance(values, Mapping):
            for name, value in values.items():
                ref = ranges.get(name, {}) if isinstance(ranges, Mapping) else {}
                quality_ok = quality.get(name, True) if isinstance(quality, Mapping) else True
                result = classify_variable(
                    value,
                    ref.get("lower") if isinstance(ref, Mapping) else None,
                    ref.get("upper") if isinstance(ref, Mapping) else None,
                    quality_ok=quality_ok,
                    margin_fraction=self.margin_fraction,
                )
                if not quality_ok and isinstance(quality_reasons, Mapping):
                    result["reason"] = quality_reasons.get(name) or result["reason"]
                variable_assessments[str(name)] = result
                if result["score"] != NOMINAL:
                    alert = {
                        "variable": str(name),
                        "score": result["score"],
                        "level": result["level"],
                        "measured_value": value,
                        "reference_range": ref if isinstance(ref, Mapping) else {},
                        "message": f"{result['level']}: {name} — {result['reason']}",
                    }
                    crew_alerts.append(alert)

        # Retain detection for legacy anomaly_result payloads without values/ranges.
        z_scores = anomaly_result.get("z_scores", {})
        anomaly_names = []
        if isinstance(z_scores, Mapping):
            for name, raw in z_scores.items():
                try:
                    z = float(raw)
                except (TypeError, ValueError):
                    continue
                if math.isfinite(z) and abs(z) >= self.anomaly_z_threshold:
                    anomaly_names.append(str(name))
        for group_name in ("below_range", "above_range"):
            group = anomaly_result.get(group_name, {})
            if isinstance(group, Mapping):
                anomaly_names.extend(str(k) for k, v in group.items() if bool(v))
        anomaly_names.extend(name for name, item in variable_assessments.items()
                             if item["score"] != NOMINAL)
        anomaly_names = sorted(set(anomaly_names))
        if anomaly_names:
            reasons.append("Material-profile deviations: " + ", ".join(anomaly_names))
        if crew_alerts:
            reasons.append(f"{len(crew_alerts)} variable(s) require crew review.")
        if anomaly_result.get("warning"):
            limitations.append(str(anomaly_result["warning"]))

        adverse_probability = None
        if probabilities:
            vals = {str(k): _finite_probability(v) for k, v in probabilities.items()}
            if (any(v is None for v in vals.values())
                    or abs(sum(v for v in vals.values() if v is not None) - 1.0) > 1e-3):
                limitations.append("Class probabilities are invalid or do not sum to 1.")
            elif not self.adverse_classes:
                limitations.append("No adverse classes were configured; model probability was not interpreted.")
            elif not self.adverse_classes.issubset(set(vals)):
                limitations.append("One or more configured adverse classes are absent from model output.")
            else:
                adverse_probability = sum(vals[label] for label in self.adverse_classes)
                if adverse_probability > 0:
                    reasons.append("Model assigns probability to an adverse outcome.")
        elif self.adverse_classes:
            limitations.append("No class probabilities were supplied.")

        comparable = str(comparability_class).lower() if comparability_class is not None else ""
        if comparable and comparable not in {"comparable", "high"}:
            limitations.append(f"Experimental comparability is '{comparability_class}', not confirmed high.")
        elif not comparable:
            limitations.append("Experimental comparability was not provided.")

        score = None
        if adverse_probability is not None:
            score = min(1.0, adverse_probability + min(len(anomaly_names), 5) * 0.05)
        if crew_alerts:
            status = "crew_review_required"
        elif score is None:
            status = "insufficient_evidence"
        elif limitations:
            status = "insufficient_evidence"
        elif score >= 0.5:
            status = "elevated_review_priority"
        elif anomaly_names:
            status = "review_anomalies"
        else:
            status = "model_screened_lower_priority"

        if not reasons:
            reasons.append("No variable-level anomaly or adverse model signal was identified.")
        limitations.append("Historical profile ranges and triage scores are not validated safety limits or safety certification.")
        return RiskAssessment(
            status=status,
            risk_score=score,
            predicted_adverse_probability=adverse_probability,
            anomaly_count=len(anomaly_names),
            reasons=reasons,
            limitations=limitations,
            variable_assessments=variable_assessments,
            crew_alerts=crew_alerts,
        )
