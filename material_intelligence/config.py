
# Choose the prediction target:
TARGET = "sustained"

# Alternative:
# TARGET = "outcome"

NUMERIC_FEATURES = [
    "thickness_mm",
    "heated_thickness_mm",
    "width_cm",
    "burning_sides",
    "areal_density_kg_m2",
    "o2_initial_pct",
    "pressure_kpa",
    "pressure_series_range_kpa",
    "flow_cms",
    "gravity"
]

CATEGORICAL_FEATURES = [
    "material",
    "material_family",
    "geometry_class",
    "o2_basis",
    "pressure_source",
    "flow_config"
]

ID_COLUMNS = [
    "investigation",
    "test_id",
    "segment"
]

RANDOM_STATE = 42

HIDDEN_SIZE = 16
LEARNING_RATE = 0.01
EPOCHS = 1000
