"""NASA POWER daily point API (no key needed)."""
import httpx
from ..config import HTTP_TIMEOUT
from .derive import clean

URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = "PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,RH2M,WS2M,ALLSKY_SFC_SW_DWN"

def fetch_daily(lat, lon, start=19910101, end=20201231):
    r = httpx.get(URL, params={"parameters": PARAMS, "community": "AG", "longitude": lon, "latitude": lat,
                               "start": start, "end": end, "format": "JSON"}, timeout=HTTP_TIMEOUT * 3)
    r.raise_for_status()
    p = r.json()["properties"]["parameter"]
    days = sorted(p["PRECTOTCORR"].keys())
    return [{"date": d, **{k: clean(p[k].get(d)) for k in p}} for d in days]
