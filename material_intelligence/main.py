"""CLI training entry point. Run: python main.py --data data/runs.csv"""
import argparse
import numpy as np
import pandas as pd
from config import (
    TARGET,
    HIDDEN_SIZE,
    LEARNING_RATE,
    EPOCHS,
    RANDOM_STATE,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
)
from preprocessing import DataProcessor
from mlp import MLP
from evaluation import Evaluator
from model_artifacts import save_artifacts


def run_grouped_cv(df, classes, n_splits=5):

    print(f"\nRunning {n_splits}-fold grouped cross-validation...")

    all_actual = []
    all_predicted = []

    df = df.dropna(subset=[TARGET]).copy()
    classes = sorted(df[TARGET].dropna().unique().tolist(), key=str)
    evaluator = Evaluator(classes)

    print("Classes used:", classes)

    for fold, (train_idx, val_idx) in enumerate(
        DataProcessor().get_group_folds(df, TARGET, n_splits),
        start=1
    ):
        train_df = df.iloc[train_idx].copy()
        val_df = df.iloc[val_idx].copy()

        train_counts = train_df[TARGET].value_counts()

        print(f"\nFold {fold}")
        print("Training classes:", train_counts.to_dict())
        print("Validation classes:", val_df[TARGET].value_counts().to_dict())

        missing = set(classes) - set(train_counts.index)
        if missing:
            raise ValueError(
                f"Fold {fold} training data is missing classes: {missing}. "
                "Five-fold evaluation is not reliable with this group distribution."
            )

        processor = DataProcessor()
        X_train = processor.fit_transform(train_df)
        X_val = processor.transform(val_df)

        y_train = evaluator.encode(train_df[TARGET].to_numpy())

        model = MLP(
            X_train.shape[1],
            HIDDEN_SIZE,
            len(classes),
            LEARNING_RATE,
            random_state=RANDOM_STATE + fold - 1,
        )

        model.train(X_train, y_train, EPOCHS, verbose=False)

        predictions = model.predict(X_val)
        actual = np.argmax(
            evaluator.encode(val_df[TARGET].to_numpy()),
            axis=1
        )

        all_actual.extend(actual.tolist())
        all_predicted.extend(predictions.tolist())

    print("\nCombined cross-validation results:")
    metrics = evaluator.report(all_actual, all_predicted)

    print(
        "\nReminder: these are grouped cross-validation results, "
        "not external validation."
    )

    return metrics


def train(data_path="data/runs.csv", artifact_dir="artifacts"):
    processor = DataProcessor()
    df = processor.load_data(data_path)
    if TARGET not in df.columns:
        raise ValueError(f"Target {TARGET!r} not found.")
    required = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing configured model features: {missing}")
    train_df, test_df = processor.split_data(df, TARGET)
    classes = sorted(train_df[TARGET].dropna().unique().tolist(), key=str)
    if len(classes) < 2:
        raise ValueError("At least two target classes are required.")
    if not set(test_df[TARGET].unique()).issubset(set(classes)):
        raise ValueError("A target class exists in testing but not training.")
    evaluator = Evaluator(classes)
    cv_metrics = run_grouped_cv(df, classes, n_splits=5)
    y_train = evaluator.encode(train_df[TARGET].to_numpy())
    y_test = evaluator.encode(test_df[TARGET].to_numpy())
    X_train = processor.fit_transform(train_df)
    X_test = processor.transform(test_df)
    model = MLP(
        X_train.shape[1],
        HIDDEN_SIZE,
        len(classes),
        LEARNING_RATE,
        random_state=RANDOM_STATE,
    )
    model.train(X_train, y_train, EPOCHS)
    predictions = model.predict(X_test)
    actual = np.argmax(y_test, axis=1)
    metrics = evaluator.report(actual, predictions)
    print("\nActual test class counts:")
    print(test_df[TARGET].value_counts())

    print("\nPredicted test class counts:")
    print(pd.Series([classes[i] for i in predictions]).value_counts())

    print("\nTraining class counts:")
    print(train_df[TARGET].value_counts())  
    save_artifacts(model, processor, classes, artifact_dir)
    print(f"Saved model artifacts to: {artifact_dir}")
    print("WARNING: single grouped holdout only; report is not external validation.")
    print("WARNING: softmax outputs are uncalibrated model scores, not fire-risk probabilities.")
    return {
    "model": model,
    "processor": processor,
    "classes": classes,
    "metrics": metrics,
    "cv_metrics": cv_metrics,
    "train_rows": len(train_df),
    "test_rows": len(test_df)
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/runs.csv")
    parser.add_argument("--artifacts", default="artifacts")
    args = parser.parse_args()
    train(args.data, args.artifacts)
