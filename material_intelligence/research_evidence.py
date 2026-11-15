"""Curated evidence notes. These are context flags, not numerical control limits."""
from optimizer_contracts import EvidenceRecord

EVIDENCE = [
    EvidenceRecord(
        level="research", material="PMMA", geometry="thin sheet",
        regime="opposed-flow microgravity and downward normal-gravity; 60-101.3 kPa; 21-35.4 vol% O2; 30-200 mm/s forced opposed flow (microgravity subset)",
        claim=("Ries et al. report that along the normoxic curve flame spread increased with oxygen concentration "
               "and decreasing pressure; opposed-flow velocity mattered in the tested range. Results are specific "
               "to their PMMA sheet configurations and regimes."),
        source="https://doi.org/10.1016/j.proci.2024.105358",
        limitations="Do not extrapolate to other materials, thicknesses, geometries, flow regimes, or gravity levels."
    ),
    EvidenceRecord(
        level="research", material="CFRP", geometry="sheet",
        regime="opposed-flow flame spread; velocity-dependent limiting oxygen concentration",
        claim=("Kobayashi et al. report a non-monotonic limiting-oxygen-concentration response across "
               "the tested opposed-flow velocities; a universal monotonic flow rule is not justified."),
        source="https://doi.org/10.1016/j.proci.2024.105597",
        limitations="Material- and apparatus-specific; do not use as a numeric envelope for other composites."
    ),
    EvidenceRecord(
        level="research", material="unidirectional CFRP", geometry="sheet",
        regime="2026 ICES proceedings paper; analytical model for downward flame spread under natural convection",
        claim=("Kobayashi et al. describe a CFRP flame-spread model whose calculated spread-rate trends depend "
               "on oxygen concentration and whose limiting-oxygen-concentration predictions are compared with "
               "experiment. The title identifies a microgravity context; the abstract does not establish a "
               "transferable gravity correction."),
        source="https://doi.org/10.32865/2346/109009",
        limitations="Proceedings paper and material/model-specific; reported model agreement does not authorize settings or cross-material use."
    ),
    EvidenceRecord(
        level="research", material="multiple materials", geometry="test configurations",
        regime="NASA-STD-6001B with Change 3; active standard page accessed 2026-11-15",
        claim=("NASA lists NASA-STD-6001B with Change 3 as active and describes its scope as requirements "
               "for evaluating, testing, and selecting materials for space vehicles and associated ground "
               "support equipment. It is a test/assessment standard, not a predictive model."),
        source="https://standards.nasa.gov/standard/NASA/NASA-STD-6001",
        limitations="Use the current standard and program-specific applicability; it does not establish universal model bounds."
    ),
    EvidenceRecord(
        level="research", material="polymeric materials", geometry="multiple",
        regime="oxygen concentration versus oxygen partial pressure",
        claim=("Harper et al. report that flammability in their evaluated datasets appeared more dependent "
               "on oxygen concentration than equivalent oxygen partial pressure."),
        source="https://doi.org/10.1520/STP159620150081",
        limitations="Do not infer that oxygen partial pressure is irrelevant; scope is the evaluated materials and methods."
    ),
    EvidenceRecord(
        level="research", material="multiple", geometry="spacecraft material configurations",
        regime="gravity and environmental applicability",
        claim=("NASA configuration-analysis guidance notes limited evidence on partial-gravity effects and "
               "requires gravity/environment applicability to be considered; sparse data should remain an explicit limitation."),
        source="https://standards.nasa.gov/system/files/tmp/JSC%2029353D%20Flammability%20Configuration%20Analysis%20for%20Spacecraft%20Applications.pdf",
        limitations="Guidance acknowledges evidence gaps; no general gravity correction is encoded."
    ),
]
