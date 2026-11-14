"""ISRIC SoilGrids REST (0-30 cm mean of the three top layers)."""
import httpx
from ..config import HTTP_TIMEOUT

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
# conversion factors from mapped units to conventional units
SCALE = {"clay": 10, "sand": 10, "silt": 10, "soc": 10, "phh2o": 10}  # g/kg->%, dg/kg->g/kg, pH*10

def fetch_soil(lat, lon):
    r = httpx.get(URL, params=[("lat", lat), ("lon", lon), ("property", "clay"), ("property", "sand"),
                               ("property", "silt"), ("property", "soc"), ("property", "phh2o"),
                               ("depth", "0-5cm"), ("depth", "5-15cm"), ("depth", "15-30cm"), ("value", "mean")],
                  timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    out = {}
    for layer in r.json()["properties"]["layers"]:
        vals = [d["values"]["mean"] for d in layer["depths"] if d["values"].get("mean") is not None]
        if vals:
            out[layer["name"]] = sum(vals) / len(vals) / SCALE.get(layer["name"], 1)
    return {"clay": out.get("clay"), "sand": out.get("sand"), "silt": out.get("silt"),
            "soc": out.get("soc"), "ph": out.get("phh2o"), "source": "ISRIC SoilGrids 2.0"}
