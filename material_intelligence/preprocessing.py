from sklearn.model_selection import GroupKFold
import numpy as np
import pandas as pd

from config import (
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
)


class DataProcessor:

    def __init__(self):
        self.numeric_medians = None
        self.numeric_means = None
        self.numeric_stds = None
        self.category_columns = None
        self.numeric_min = None
        self.numeric_max = None
        self.category_values = None

    def load_data(self, filename):
        df = pd.read_csv(filename)

        # Clean HTML entities and unusual prefixes
        import html
        df.columns = [
            html.unescape(str(c)).lstrip("*").strip()
            for c in df.columns
        ]

        return df

    
    def split_data(self, df, target, test_ratio=0.2):

        df = df.dropna(subset=[target]).copy()

        group_columns = [
            c for c in ["investigation", "test_id"]
            if c in df.columns
        ]

        if not group_columns:
            raise ValueError(
                "Experiment identifiers are required for grouped splitting."
            )

        groups = (
            df[group_columns]
            .fillna("UNKNOWN")
            .astype(str)
            .agg("|".join, axis=1)
        )

        unique_groups = np.unique(groups)

        rng = np.random.default_rng(42)
        shuffled = rng.permutation(unique_groups)

        if len(shuffled) < 2:
            raise ValueError(
                "At least two independent experiment groups are required."
            )

        n_test = max(
            1,
            min(
                len(shuffled) - 1,
                int(np.ceil(len(shuffled) * test_ratio))
            )
        )

        test_groups = set(shuffled[:n_test])
        test_mask = groups.isin(test_groups)

        return (
            df.loc[~test_mask].copy(),
            df.loc[test_mask].copy()
        )

    def get_group_folds(self, df, target, n_splits=5):
        df = df.dropna(subset=[target]).copy()

        group_columns = [
            c for c in ["investigation", "test_id"]
            if c in df.columns
        ]

        if not group_columns:
            raise ValueError("Experiment identifiers are required.")

        groups = (
            df[group_columns]
            .fillna("UNKNOWN")
            .astype(str)
            .agg("|".join, axis=1)
        )

        if groups.nunique() < n_splits:
            raise ValueError(
                f"Need at least {n_splits} independent groups; "
                f"found {groups.nunique()}."
            )

        splitter = GroupKFold(n_splits=n_splits)

        return list(
            splitter.split(df, df[target], groups)
        )

    def fit_transform(self, df):

        X = df[
            NUMERIC_FEATURES + CATEGORICAL_FEATURES
        ].copy()

        # Numerical missing-value handling
        numeric = X[NUMERIC_FEATURES].apply(
            pd.to_numeric, errors="coerce"
        )

        self.numeric_medians = numeric.median().fillna(0)
        numeric = numeric.fillna(self.numeric_medians)
        self.numeric_min = numeric.min()
        self.numeric_max = numeric.max()

        self.numeric_means = numeric.mean()
        self.numeric_stds = numeric.std(ddof=0).replace(0, 1)

        numeric = (
            numeric - self.numeric_means
        ) / self.numeric_stds

        # Categorical missing values
        categorical = X[CATEGORICAL_FEATURES].copy()

        for col in CATEGORICAL_FEATURES:
            categorical[col] = (
                categorical[col].fillna("UNKNOWN").astype(str)
            )

        self.category_values = {
            col: sorted(categorical[col].unique().tolist())
            for col in CATEGORICAL_FEATURES
        }
        encoded = pd.get_dummies(
            categorical,
            dtype=float
        )

        self.category_columns = encoded.columns.tolist()

        return np.column_stack([
            numeric.to_numpy(dtype=float),
            encoded.to_numpy(dtype=float)
        ])

    def transform(self, df):

        numeric = df[NUMERIC_FEATURES].copy()

        numeric = numeric.apply(
            pd.to_numeric, errors="coerce"
        )

        numeric = numeric.fillna(self.numeric_medians)

        numeric = (
            numeric - self.numeric_means
        ) / self.numeric_stds

        categorical = df[CATEGORICAL_FEATURES].copy()

        for col in CATEGORICAL_FEATURES:
            categorical[col] = (
                categorical[col].fillna("UNKNOWN").astype(str)
            )

        encoded = pd.get_dummies(
            categorical,
            dtype=float
        )

        encoded = encoded.reindex(
            columns=self.category_columns,
            fill_value=0
        )

        return np.column_stack([
            numeric.to_numpy(dtype=float),
            encoded.to_numpy(dtype=float)
        ])


    def save_state(self, path):
        """Save fitted preprocessing metadata as JSON (no executable pickle)."""
        import json
        payload = {
            "numeric_medians": self.numeric_medians.to_dict(),
            "numeric_means": self.numeric_means.to_dict(),
            "numeric_stds": self.numeric_stds.to_dict(),
            "numeric_min": self.numeric_min.to_dict(),
            "numeric_max": self.numeric_max.to_dict(),
            "category_columns": self.category_columns,
            "category_values": self.category_values,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def load_state(self, path):
        import json
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        self.numeric_medians = pd.Series(payload["numeric_medians"])
        self.numeric_means = pd.Series(payload["numeric_means"])
        self.numeric_stds = pd.Series(payload["numeric_stds"])
        self.numeric_min = pd.Series(payload["numeric_min"])
        self.numeric_max = pd.Series(payload["numeric_max"])
        self.category_columns = payload["category_columns"]
        self.category_values = payload["category_values"]
        return self

    def domain_report(self, df, z_limit=3.0):
        """Flag extrapolation and unseen categories; not a calibrated uncertainty."""
        issues = []
        for col in NUMERIC_FEATURES:
            vals = pd.to_numeric(df[col], errors="coerce")
            bad = vals.isna()
            if bad.any():
                issues.append({"feature": col, "type": "missing_or_non_numeric",
                               "count": int(bad.sum())})
            if self.numeric_stds is not None:
                z = (vals - self.numeric_means[col]) / self.numeric_stds[col]
                extreme = z.abs() > z_limit
                if extreme.any():
                    issues.append({"feature": col, "type": "outside_training_distribution",
                                   "count": int(extreme.sum()), "z_limit": float(z_limit)})
        for col in CATEGORICAL_FEATURES:
            known = set((self.category_values or {}).get(col, []))
            vals = df[col].fillna("UNKNOWN").astype(str)
            unseen = ~vals.isin(known)
            if unseen.any():
                issues.append({"feature": col, "type": "unseen_category",
                               "values": sorted(vals[unseen].unique().tolist())[:20],
                               "count": int(unseen.sum())})
        return {"in_domain": not bool(issues), "issues": issues,
                "warning": "Domain flags are screening diagnostics, not probabilistic uncertainty bounds."}
