"""Backend facade for existing UI/API integration."""
from prediction_service import PredictionService
from risk_engine import RiskEngine
from corrective_optimizer import CorrectiveOptimizer
from material_analyzer import MaterialAnalyzer
from optimizer_contracts import RecommendationPayload

class MaterialIntelligenceService:
    def __init__(self, model, processor, classes, adverse_classes,
                 variable_specs=(), min_profile_samples=5):
        self.predictions = PredictionService(model, processor, classes, adverse_classes)
        self.risk = RiskEngine(adverse_classes)
        self.optimizer = CorrectiveOptimizer(variable_specs, adverse_classes)
        self.material_analyzer = MaterialAnalyzer(min_profile_samples)

    def assess_record(self, record, candidates=()):
        import pandas as pd
        frame = record.copy() if isinstance(record, pd.DataFrame) else pd.DataFrame([record])
        prediction = self.predictions.predict(frame)[0]
        material = str(frame.iloc[0].get("material", "unknown"))
        comparability = frame.iloc[0].get("comparability_class", None)
        risk = self.risk.assess(
            prediction["class_scores"] or None, None, comparability
        ).to_dict()
        reviews = []
        if prediction["usable_for_optimizer"]:
            reviews = self.optimizer.rank(candidates)
        else:
            reviews = [{
                "scenario_id": getattr(c, "scenario_id", "unknown"),
                "decision": "withhold", "safety_gate": "failed",
                "adverse_probability": None, "performance_score": None,
                "evidence_level": "unknown",
                "reasons": ["Baseline prediction is invalid or outside the training domain."]
            } for c in candidates]
        return RecommendationPayload(
            test_id=str(frame.iloc[0].get("test_id", "unassigned")),
            material=material, risk=risk, candidate_reviews=reviews,
            monitoring_status="awaiting_qualified_follow_up_test"
        ).to_dict()
