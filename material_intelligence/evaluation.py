import numpy as np

class Evaluator:
    def __init__(self, classes):
        self.classes = list(classes)

    def encode(self, values):
        mapping = {label: i for i, label in enumerate(self.classes)}
        unknown = sorted(set(values) - set(mapping), key=str)
        if unknown:
            raise ValueError(f"Unknown target labels: {unknown}")
        indices = np.array([mapping[value] for value in values], dtype=int)
        encoded = np.zeros((len(indices), len(self.classes)))
        encoded[np.arange(len(indices)), indices] = 1
        return encoded

    def confusion_matrix(self, actual, predicted):
        matrix = np.zeros((len(self.classes), len(self.classes)), dtype=int)
        for a, p in zip(actual, predicted):
            matrix[int(a), int(p)] += 1
        return matrix

    def report(self, actual, predicted):
        actual, predicted = np.asarray(actual), np.asarray(predicted)
        if len(actual) == 0 or len(actual) != len(predicted):
            raise ValueError("Actual and predicted arrays must have equal non-zero length.")
        matrix = self.confusion_matrix(actual, predicted)
        accuracy = float(np.mean(actual == predicted))
        metrics = {"accuracy": accuracy, "confusion_matrix": matrix.tolist(), "per_class": {}}
        print("\nConfusion matrix:")
        print(matrix)
        majority = float(matrix.sum(axis=1).max() / matrix.sum())
        print(f"\nAccuracy: {accuracy:.4f}  (always predicting the most common class: {majority:.4f})")
        for i, name in enumerate(self.classes):
            tp = matrix[i, i]
            fp, fn = matrix[:, i].sum() - tp, matrix[i, :].sum() - tp
            precision = tp / max(tp + fp, 1)
            recall = tp / max(tp + fn, 1)
            f1 = 2 * precision * recall / max(precision + recall, 1e-12)
            metrics["per_class"][str(name)] = {
                "precision": float(precision), "recall": float(recall),
                "f1": float(f1), "support": int(matrix[i, :].sum())
            }
            print(f"\nClass: {name}\nPrecision: {precision:.4f}\nRecall: {recall:.4f}\nF1-score: {f1:.4f}")
        metrics["majority_baseline"] = majority
        metrics["balanced_accuracy"] = float(np.mean([m["recall"] for m in metrics["per_class"].values()]))
        print(f"\nBalanced accuracy (mean recall): {metrics['balanced_accuracy']:.4f}")
        return metrics
