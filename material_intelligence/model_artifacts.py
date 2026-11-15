"""Safe-format persistence helpers for model/preprocessor artifacts."""
import json, os
from mlp import MLP
from preprocessing import DataProcessor

def save_artifacts(model, processor, classes, directory="artifacts"):
    os.makedirs(directory, exist_ok=True)
    model.save(os.path.join(directory, "mlp_weights.npz"))
    processor.save_state(os.path.join(directory, "preprocessor.json"))
    with open(os.path.join(directory, "classes.json"), "w", encoding="utf-8") as f:
        json.dump([str(c) for c in classes], f, indent=2)
    return directory

def load_artifacts(directory="artifacts"):
    model = MLP.load(os.path.join(directory, "mlp_weights.npz"))
    processor = DataProcessor().load_state(os.path.join(directory, "preprocessor.json"))
    with open(os.path.join(directory, "classes.json"), encoding="utf-8") as f:
        classes = json.load(f)
    if model.W2.shape[1] != len(classes):
        raise ValueError("Stored class list does not match model output size.")
    return model, processor, classes
