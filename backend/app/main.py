import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import init_db
from .routers import banks, questions, quiz, stats, ai, review

app = FastAPI(title="题库抽题系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(banks.router, prefix="/api", tags=["题库管理"])
app.include_router(questions.router, prefix="/api", tags=["题目管理"])
app.include_router(quiz.router, prefix="/api", tags=["作答"])
app.include_router(stats.router, tags=["统计"])
app.include_router(ai.router, tags=["AI"])
app.include_router(review.router, prefix="/api", tags=["复习"])


@app.on_event("startup")
def startup():
    init_db()


# Serve frontend static files
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
has_frontend = os.path.exists(frontend_dist)

if has_frontend:
    # Mount assets at /assets
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA fallback: serve index.html for all non-API routes
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(frontend_dist, "index.html"))
