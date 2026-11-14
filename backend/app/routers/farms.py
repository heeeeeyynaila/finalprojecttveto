import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ..db import conn, dumps, now
from ..services import location

router = APIRouter(prefix="/v1/farms", tags=["farms"])

class FarmIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=64)   # anonymous random id from the browser
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    inputs: dict = {}

class AttemptIn(BaseModel):
    rotation: list[str] = Field(min_length=1, max_length=10)
    score: float | None = None
    details: dict = {}

@router.post("", status_code=201)
def create_farm(f: FarmIn):
    fid = uuid.uuid4().hex
    cell_id = location.cell_for(f.lat, f.lon)[0]
    with conn() as c:
        c.execute("INSERT INTO farm VALUES (?,?,?,?,?,?,?)", (fid, f.device_id, f.lat, f.lon, cell_id, dumps(f.inputs), now()))
    return {"farm_id": fid, "cell_id": cell_id}

@router.post("/{farm_id}/attempts", status_code=201)
def add_attempt(farm_id: str, a: AttemptIn):
    with conn() as c:
        if not c.execute("SELECT 1 FROM farm WHERE farm_id=?", (farm_id,)).fetchone():
            raise HTTPException(404, "farm not found")
        known = {r["crop_id"] for r in c.execute("SELECT crop_id FROM crop")}
        bad = [x for x in a.rotation if x not in known]
        if bad:
            raise HTTPException(422, f"unknown crops: {bad}")
        aid = uuid.uuid4().hex
        c.execute("INSERT INTO game_attempt VALUES (?,?,?,?,?,?)", (aid, farm_id, dumps(a.rotation), a.score, dumps(a.details), now()))
    return {"attempt_id": aid}

@router.get("/{farm_id}/attempts")
def list_attempts(farm_id: str):
    import json
    with conn() as c:
        rows = c.execute("SELECT * FROM game_attempt WHERE farm_id=? ORDER BY created_at DESC", (farm_id,)).fetchall()
    return [{"attempt_id": r["attempt_id"], "rotation": json.loads(r["rotation"]), "score": r["score"], "created_at": r["created_at"]} for r in rows]
