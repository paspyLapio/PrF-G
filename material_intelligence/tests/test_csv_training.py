import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from config import CATEGORICAL_FEATURES, NUMERIC_FEATURES
from main import train
from mlp import MLP
from model_artifacts import load_artifacts
from prediction_service import PredictionService


class TestCsvTraining(unittest.TestCase):
    def test_seeded_mlp_initialization_is_repeatable(self):
        first = MLP(3, 4, 2, random_state=17)
        second = MLP(3, 4, 2, random_state=17)

        np.testing.assert_array_equal(first.W1, second.W1)
        np.testing.assert_array_equal(first.W2, second.W2)

    def test_training_loads_csv_and_saves_model_artifacts(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_path = Path(temp_dir) / "runs.csv"
            artifact_dir = Path(temp_dir) / "artifacts"
            columns = [
                "investigation",
                "test_id",
                "segment",
                *NUMERIC_FEATURES,
                *CATEGORICAL_FEATURES,
                "sustained",
            ]
            with data_path.open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=columns)
                writer.writeheader()
                for group in range(10):
                    for target, thickness in (("no", 1.0), ("yes", 2.0)):
                        row = {
                            "investigation": "synthetic-study",
                            "test_id": f"test-{group}",
                            "segment": target,
                            "sustained": target,
                        }
                        row.update({
                            name: float(group + 1) if name != "thickness_mm" else thickness
                            for name in NUMERIC_FEATURES
                        })
                        row.update({
                            name: f"category-{name}"
                            for name in CATEGORICAL_FEATURES
                        })
                        writer.writerow(row)
                        sample_record = row

            with patch("main.EPOCHS", 2), patch("main.HIDDEN_SIZE", 4):
                result = train(str(data_path), str(artifact_dir))

            model, processor, classes = load_artifacts(str(artifact_dir))
            prediction = PredictionService(
                model, processor, classes, adverse_classes={"yes"}
            ).predict([sample_record])[0]

            self.assertEqual(result["train_rows"] + result["test_rows"], 20)
            self.assertEqual(result["classes"], ["no", "yes"])
            self.assertTrue(prediction["usable_for_optimizer"])
            self.assertTrue((artifact_dir / "mlp_weights.npz").is_file())
            self.assertTrue((artifact_dir / "preprocessor.json").is_file())
            self.assertTrue((artifact_dir / "classes.json").is_file())


if __name__ == "__main__":
    unittest.main()
