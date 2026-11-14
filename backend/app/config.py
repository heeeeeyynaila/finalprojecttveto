import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = os.getenv("DATABASE_PATH", str(ROOT / "fieldshift.db"))
OFFLINE = os.getenv("OFFLINE", "0") == "1"
GRID_STEP = 0.5  # NASA POWER cell is ~0.5 deg (~50 km) -> be honest about it
EARTHDATA_USERNAME = os.getenv("EARTHDATA_USERNAME", "")
EARTHDATA_PASSWORD = os.getenv("EARTHDATA_PASSWORD", "")
OPENTOPOGRAPHY_KEY = os.getenv("OPENTOPOGRAPHY_KEY", "")
CDSAPI_KEY = os.getenv("CDSAPI_KEY", "")
HTTP_TIMEOUT = 60
