"""Append-only follow-up test ledger. No automatic retraining or approvals."""
import json, os, uuid
from datetime import datetime, timezone

class FeedbackLedger:
    REQUIRED = {"scenario_id", "prediction_record", "actual_record", "reviewer"}

    def __init__(self, path="data/feedback.jsonl"):
        self.path = path

    def append(self, entry):
        missing = self.REQUIRED - set(entry)
        if missing:
            raise ValueError(f"Missing feedback fields: {sorted(missing)}")
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        record = dict(entry)
        record["feedback_id"] = str(uuid.uuid4())
        record["recorded_at_utc"] = datetime.now(timezone.utc).isoformat()
        record["status"] = "human_review_required"
        record["training_use"] = "not_approved"
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, allow_nan=False) + "\n")
        return record

    def read_all(self):
        if not os.path.exists(self.path):
            return []
        with open(self.path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
