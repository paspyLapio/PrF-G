
import numpy as np


class MLP:

    def __init__(
        self,
        input_size,
        hidden_size,
        output_size,
        learning_rate=0.01,
        random_state=None,
    ):

        rng = np.random.default_rng(random_state)

        self.W1 = (
            rng.standard_normal((input_size, hidden_size))
            * np.sqrt(1 / input_size)
        )

        self.W2 = (
            rng.standard_normal((hidden_size, output_size))
            * np.sqrt(1 / hidden_size)
        )

        self.b1 = np.zeros((1, hidden_size))
        self.b2 = np.zeros((1, output_size))

        self.learning_rate = learning_rate

    def sigmoid(self, x):
        x = np.clip(x, -500, 500)
        return 1 / (1 + np.exp(-x))

    def softmax(self, x):
        x = x - np.max(x, axis=1, keepdims=True)
        exp_x = np.exp(x)

        return exp_x / np.sum(
            exp_x, axis=1, keepdims=True
        )

    def forward(self, X):

        self.hidden_input = X @ self.W1 + self.b1

        self.hidden_output = self.sigmoid(
            self.hidden_input
        )

        self.output_input = (
            self.hidden_output @ self.W2 + self.b2
        )

        self.output = self.softmax(self.output_input)

        return self.output

    def backward(self, X, y):

        output_error = (
            (self.output - y) * self.sample_weights[:, None]
            / np.sum(self.sample_weights)
        )

        hidden_error = (
            output_error @ self.W2.T
        ) * (
            self.hidden_output *
            (1 - self.hidden_output)
        )

        dW2 = self.hidden_output.T @ output_error
        db2 = np.sum(output_error, axis=0, keepdims=True)

        dW1 = X.T @ hidden_error
        db1 = np.sum(hidden_error, axis=0, keepdims=True)

        self.W2 -= self.learning_rate * dW2
        self.b2 -= self.learning_rate * db2

        self.W1 -= self.learning_rate * dW1
        self.b1 -= self.learning_rate * db1

    def train(self, X, y, epochs=1000, verbose=True):

        class_counts = np.sum(y, axis=0)
        if np.any(class_counts == 0):
            raise ValueError("Training data is missing a class.")

        class_weights = len(y) / (y.shape[1] * class_counts)
        self.sample_weights = y @ class_weights

        for epoch in range(epochs):

            self.forward(X)
            self.backward(X, y)

            if verbose and (epoch + 1) % 100 == 0:
                loss = -np.mean(
                    np.sum(
                        y * np.log(self.output + 1e-8),
                        axis=1
                    )
                )
                print(f"Epoch {epoch+1} | Loss: {loss:.5f}")

    def predict_proba(self, X):
        return self.forward(X)

    def predict(self, X):
        return np.argmax(
            self.predict_proba(X),
            axis=1
        )


    def save(self, path):
        """Persist numeric model weights as a compressed NumPy archive."""
        np.savez_compressed(
            path, W1=self.W1, W2=self.W2, b1=self.b1, b2=self.b2,
            learning_rate=np.asarray([self.learning_rate], dtype=float)
        )

    @classmethod
    def load(cls, path):
        """Load weights without pickle; dimensions are inferred from arrays."""
        with np.load(path, allow_pickle=False) as data:
            W1, W2 = data["W1"], data["W2"]
            model = cls(W1.shape[0], W1.shape[1], W2.shape[1],
                        float(data["learning_rate"][0]))
            if data["b1"].shape != (1, W1.shape[1]) or data["b2"].shape != (1, W2.shape[1]):
                raise ValueError("Invalid model bias dimensions")
            model.W1, model.W2 = W1.copy(), W2.copy()
            model.b1, model.b2 = data["b1"].copy(), data["b2"].copy()
            return model
