"""Where the pipeline reads and writes, relative to the repository root."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

RAW = ROOT / "data" / "raw"  # downloads: never committed
INTERIM = ROOT / "data" / "interim"  # the Doctor Who rows of the IMDb dumps: never committed
REFERENCE = ROOT / "reference"  # the hand-checked tables from Wikipedia: committed
EXPORT = ROOT / "demo" / "public" / "data" / "episodes.json"  # the demo's data: committed
FIXTURES = ROOT / "demo" / "test" / "fixtures"  # the rankings reference, for the JS tests
