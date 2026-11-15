"""Safety-first evaluator for human-proposed corrective-action scenarios.

The module deliberately does not generate combustion operating settings.
It evaluates only candidate scenarios supplied by a qualified user and
contained within an explicitly approved experimental envelope.
"""
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence
import math


@dataclass
class VariableSpec:
    name: str
    unit: str
    controllable: bool
    approved_min: Optional[float] = None
    approved_max: Optional[float] = None
    source_note: str = ""
    evidence_level: str = "unknown"

    def validate(self):
        if self.approved_min is not None and self.approved_max is not None:
            if self.approved_min > self.approved_max:
                raise ValueError(f"Invalid approved range for {self.name}")
        if self.evidence_level not in {"research", "dataset", "validated_model", "unknown"}:
            raise ValueError(f"Unsupported evidence level for {self.name}")


@dataclass
class CandidateScenario:
    scenario_id: str
    changes: Mapping[str, float]
    predicted_probabilities: Mapping[str, float]
    performance_score: Optional[float] = None
    anomaly_count: Optional[int] = None
    evidence_level: str = "model_estimate"
    applicability: str = "unverified"
    explanation: str = ""


@dataclass
class ScenarioReview:
    scenario_id: str
    decision: str
    safety_gate: str
    adverse_probability: Optional[float]
    performance_score: Optional[float]
    evidence_level: str
    reasons: list = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


class CorrectiveOptimizer:
    """Ranks reviewed scenarios; never creates or applies variable changes."""

    def __init__(self, variable_specs: Iterable[VariableSpec],
                 adverse_classes: Iterable[str]):
        self.specs = {s.name: s for s in variable_specs}
        for spec in self.specs.values():
            spec.validate()
        self.adverse_classes = {str(x) for x in adverse_classes}

    @staticmethod
    def _prob(value):
        try:
            v = float(value)
        except (TypeError, ValueError):
            return None
        return v if math.isfinite(v) and 0 <= v <= 1 else None

    def _review(self, candidate: CandidateScenario) -> ScenarioReview:
        reasons = []
        if not candidate.changes:
            reasons.append("No explicit candidate changes were supplied.")
        if candidate.applicability != "supported":
            reasons.append("Material/geometry/flow/gravity applicability is not confirmed.")
        if candidate.evidence_level not in {"research_supported", "dataset_supported", "validated_model"}:
            reasons.append("Candidate evidence is estimated or unverified.")
        if candidate.anomaly_count is None:
            reasons.append("Candidate anomaly assessment is missing.")
        elif candidate.anomaly_count > 0:
            reasons.append("Candidate retains material-profile anomalies.")

        for name, value in candidate.changes.items():
            spec = self.specs.get(name)
            if spec is None:
                reasons.append(f"{name}: no variable metadata or approved envelope.")
                continue
            if not spec.controllable:
                reasons.append(f"{name}: marked non-controllable.")
                continue
            try:
                v = float(value)
            except (TypeError, ValueError):
                reasons.append(f"{name}: proposed value is not numeric.")
                continue
            if not math.isfinite(v):
                reasons.append(f"{name}: proposed value is not finite.")
                continue
            if spec.approved_min is None or spec.approved_max is None:
                reasons.append(f"{name}: no qualified approved range is defined.")
            elif not spec.approved_min <= v <= spec.approved_max:
                reasons.append(f"{name}: outside the approved experimental envelope.")

        probs = {str(k): self._prob(v) for k, v in candidate.predicted_probabilities.items()}
        if (not probs or any(v is None for v in probs.values())
                or abs(sum(v for v in probs.values() if v is not None) - 1.0) > 1e-3):
            adverse = None
            reasons.append("Predicted class probabilities are missing, invalid, or do not sum to 1.")
        elif not self.adverse_classes.issubset(set(probs)):
            adverse = None
            reasons.append("One or more configured adverse classes are absent from model output.")
        else:
            adverse = sum(probs[c] for c in self.adverse_classes)
            if adverse > 0:
                reasons.append("Model assigns non-zero probability to an adverse class; safety review is required.")
        if candidate.performance_score is not None:
            try:
                if not math.isfinite(float(candidate.performance_score)):
                    reasons.append("Performance score is not finite.")
            except (TypeError, ValueError):
                reasons.append("Performance score is invalid.")

        # No candidate is labelled approved or safe by this software.
        hard_block = any(
            ("outside the approved" in r) or ("no qualified approved range" in r)
            or ("non-controllable" in r) or ("no variable metadata" in r)
            or ("No explicit candidate changes" in r)
            or ("probabilities are missing, invalid" in r)
            or ("adverse classes are absent" in r)
        for r in reasons)
        if hard_block:
            decision, gate = "withhold", "failed"
        elif reasons:
            decision, gate = "qualified_human_review_required", "not_cleared"
        else:
            decision, gate = "qualified_human_review_required", "screening_only"

        return ScenarioReview(
            scenario_id=candidate.scenario_id,
            decision=decision,
            safety_gate=gate,
            adverse_probability=adverse,
            performance_score=candidate.performance_score,
            evidence_level=candidate.evidence_level,
            reasons=reasons or ["No automated safety approval is possible; expert review remains mandatory."],
        )

    def rank(self, candidates: Sequence[CandidateScenario]):
        """Return conservative ordering: failed gates first, then lower model adverse probability.

        Performance is only a tie-breaker after the safety screen. This is a
        triage ordering, not a recommendation to run any scenario.
        """
        reviews = [self._review(c) for c in candidates]
        # Eligible-for-review candidates first; withheld/unknown cases last.
        # Within the review queue, unknown adverse probability is always last.
        order = {"qualified_human_review_required": 0, "withhold": 1}
        reviews.sort(key=lambda r: (
            order.get(r.decision, 1),
            float("inf") if r.adverse_probability is None else r.adverse_probability,
            -(float(r.performance_score)) if r.performance_score is not None and math.isfinite(float(r.performance_score)) else float("inf"),
        ))
        return [r.to_dict() for r in reviews]


def default_variable_specs():
    """Known schema variables with units; all numeric envelopes intentionally unset.

    A qualified owner must explicitly approve any controllability and test envelope.
    """
    units = {
        "thickness_mm": "mm", "heated_thickness_mm": "mm", "width_cm": "cm",
        "burning_sides": "count", "areal_density_kg_m2": "kg/m^2",
        "o2_initial_pct": "vol%", "pressure_kpa": "kPa",
        "pressure_series_range_kpa": "kPa", "flow_cms": "cm/s",
        "gravity": "m/s^2",
    }
    non_control = {"gravity"}
    return [
        VariableSpec(name=name, unit=unit, controllable=(name not in non_control),
                     approved_min=None, approved_max=None,
                     source_note="Schema metadata only; no approved envelope established.",
                     evidence_level="unknown")
        for name, unit in units.items()
    ]
