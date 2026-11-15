"""Material-specific descriptive profiles; not engineering or safety limits."""
import numpy as np


class MaterialAnalyzer:
    def __init__(self, min_samples=5):
        self.profiles = {}
        self.min_samples = int(min_samples)
        if self.min_samples < 1:
            raise ValueError("min_samples must be at least 1")

    def learn_material(self, material, data, feature_names=None):
        material = str(material)
        arr = np.asarray(data, dtype=float)
        if arr.ndim == 1:
            arr = arr.reshape(-1, 1)
        if arr.ndim != 2 or arr.shape[0] < 1:
            raise ValueError("data must be a non-empty 2D array")
        if not np.isfinite(arr).all():
            raise ValueError("Profile data must be finite; clean data before fitting")
        names = list(feature_names or [f"feature_{i}" for i in range(arr.shape[1])])
        if len(names) != arr.shape[1] or len(set(names)) != len(names):
            raise ValueError("feature_names must be unique and match the data columns")
        mean = np.mean(arr, axis=0)
        std = np.std(arr, axis=0, ddof=1 if len(arr) > 1 else 0)
        std = np.maximum(std, 1e-8)
        self.profiles[material] = {
            "feature_names": names,
            "mean": mean,
            "std": std,
            "lower": mean - 2.0 * std,
            "upper": mean + 2.0 * std,
            "sample_count": int(arr.shape[0]),
            "profile_status": "descriptive" if arr.shape[0] >= self.min_samples else "descriptive_only",
            "quality_ok": arr.shape[0] >= self.min_samples,
        }

    def analyze(self, material, values):
        material = str(material)
        if material not in self.profiles:
            raise KeyError(f"No profile available for material {material!r}")
        profile = self.profiles[material]
        if isinstance(values, dict):
            missing = [name for name in profile["feature_names"] if name not in values]
            if missing:
                raise ValueError(f"Missing measurement values for: {missing}")
            raw_values = [values[name] for name in profile["feature_names"]]
        else:
            raw_values = values
        values_array = np.asarray(raw_values, dtype=float).reshape(-1)
        if values_array.shape[0] != profile["mean"].shape[0]:
            raise ValueError("values length does not match profile feature count")
        if not np.isfinite(values_array).all():
            raise ValueError("values must be finite")

        names = profile["feature_names"]
        values_map = dict(zip(names, values_array.tolist()))
        ranges = {
            name: {"lower": float(lo), "upper": float(hi)}
            for name, lo, hi in zip(names, profile["lower"], profile["upper"])
        }
        quality_ok = {name: profile["quality_ok"] for name in names}
        quality_reasons = {
            name: ("Reference profile has too few historical samples" if not profile["quality_ok"] else "")
            for name in names
        }
        z = (values_array - profile["mean"]) / profile["std"]
        below = values_array < profile["lower"]
        above = values_array > profile["upper"]
        return {
            "material": material,
            "feature_names": names,
            "values": values_map,
            "reference_ranges": ranges,
            "quality_ok": quality_ok,
            "quality_reasons": quality_reasons,
            "z_scores": dict(zip(names, z.tolist())),
            "below_range": dict(zip(names, below.tolist())),
            "above_range": dict(zip(names, above.tolist())),
            "sample_count": profile["sample_count"],
            "profile_status": profile["profile_status"],
            "reference_basis": "historical mean +/- 2 standard deviations",
            "warning": "Descriptive historical range only; not an engineering limit or safety threshold.",
        }
