from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routers import locations, crops, suitability, farms, sources

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title="Field Shift API", version="0.1.0", lifespan=lifespan,
              description="Decision support only. Not a replacement for farmer or agronomist judgment.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
for r in (locations, crops, suitability, farms, sources):
    app.include_router(r.router)

@app.get("/health")
def health():
    return {"ok": True}
