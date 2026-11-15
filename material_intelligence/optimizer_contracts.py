"""Shared contracts for frontend/API integration."""
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class EvidenceRecord:
    level: str  # research | dataset | validated_model | hypothesis
    claim: str
    source: Optional[str] = None
    material: Optional[str] = None
    geometry: Optional[str] = None
    regime: Optional[str] = None
    limitations: Optional[str] = None


@dataclass
class RecommendationPayload:
    test_id: str
    material: str
    risk: Dict[str, Any]
    candidate_reviews: List[Dict[str, Any]]
    monitoring_status: str
    disclaimer: str = (
        "Decision support only. No candidate is automatically approved for execution. "
        "Qualified experimental review and applicable safety procedures are required."
    )

    def to_dict(self):
        return asdict(self)
