import unittest

from risk_engine import classify_variable


class TestRiskLevels(unittest.TestCase):

    def test_nominal(self):
        result = classify_variable(15, 10, 20)
        self.assertEqual(result["score"], 1.0)
        self.assertEqual(result["level"], "Nominal")

    def test_reduced_near_lower_limit(self):
        result = classify_variable(10.5, 10, 20)
        self.assertEqual(result["score"], 0.5)

    def test_reduced_near_upper_limit(self):
        result = classify_variable(19.5, 10, 20)
        self.assertEqual(result["score"], 0.5)

    def test_low_below_range(self):
        result = classify_variable(8, 10, 20)
        self.assertEqual(result["score"], 0.0)

    def test_low_above_range(self):
        result = classify_variable(22, 10, 20)
        self.assertEqual(result["score"], 0.0)

    def test_missing_value(self):
        result = classify_variable(None, 10, 20)
        self.assertEqual(result["score"], 0.5)


if __name__ == "__main__":
    unittest.main()
