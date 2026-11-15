"""Small integration layer joining material profiles to crew-facing alerts."""
from material_analyzer import MaterialAnalyzer
from risk_engine import RiskEngine


class MaterialAlertService:
    def __init__(self, min_profile_samples=5, margin_fraction=0.10):
        self.analyzer = MaterialAnalyzer(min_samples=min_profile_samples)
        self.risk_engine = RiskEngine(margin_fraction=margin_fraction)

    def learn_material(self, material, historical_measurements, feature_names):
        """Build a descriptive historical profile for one material."""
        self.analyzer.learn_material(material, historical_measurements, feature_names)

    def assess_measurement(self, material, current_measurements):
        """Return variable scores and crew alerts for one new measurement set.

        current_measurements may be a dict keyed by feature name, e.g.
        {"pressure_kpa": 101.2, "o2_mean_pct": 20.9}.
        """
        anomaly_result = self.analyzer.analyze(material, current_measurements)
        assessment = self.risk_engine.assess(anomaly_result=anomaly_result)
        return {
            "material": str(material),
            "status": assessment.status,
            "variable_assessments": assessment.variable_assessments,
            "crew_alerts": assessment.crew_alerts,
            "anomaly_count": assessment.anomaly_count,
            "limitations": assessment.limitations,
            "profile": {
                "sample_count": anomaly_result["sample_count"],
                "profile_status": anomaly_result["profile_status"],
                "reference_basis": anomaly_result["reference_basis"],
                "warning": anomaly_result["warning"],
            },
        }
