from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Callable, Awaitable, Any
from uuid import uuid4
import asyncio

from sources import search_duckduckgo

app = FastAPI(title="DeepWeb Search API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str
    mode: str = "aggregation"
    languages: List[str] = Field(default_factory=lambda: ["en", "it"])
    sources: List[str] = Field(default_factory=lambda: ["duckduckgo"])
    max_results: int = Field(default=5, ge=1, le=20)


SUPPORTED_SOURCES: Dict[str, Callable[..., Awaitable[List[Dict[str, Any]]]]] = {
    "duckduckgo": search_duckduckgo,
}

@app.get("/")
async def root():
    return {
        "service": "DeepWeb Search API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "api": "ok",
        "database": "ok",
        "elasticsearch": "ok",
        "redis": "ok",
        "tor": "ok"
    }

@app.post("/api/analyze")
async def analyze_query(request: dict):
    query = request.get("query", "")
    return {
        "query": query,
        "analysis": {
            "language": "en",
            "intent": "general",
            "complexity": "simple",
            "suggested_sources": ["clearnet"],
            "suggested_mode": "aggregation",
            "keywords": query.split(),
            "is_technical": False,
            "is_sensitive": False
        }
    }

@app.post("/api/search")
async def search(request: SearchRequest):
    if not request.sources:
        raise HTTPException(status_code=400, detail="At least one source must be selected.")

    handlers: Dict[str, Callable[..., Awaitable[List[Dict[str, Any]]]]] = {}
    for source in request.sources:
        handler = SUPPORTED_SOURCES.get(source)
        if handler:
            handlers[source] = handler

    if not handlers:
        raise HTTPException(status_code=400, detail="Selected sources are not supported.")

    tasks = {
        source: asyncio.create_task(
            handler(
                request.query,
                languages=request.languages,
                max_results=request.max_results,
            )
        )
        for source, handler in handlers.items()
    }

    results: List[Dict[str, Any]] = []
    errors: Dict[str, str] = {}

    for source, task in tasks.items():
        try:
            source_results = await task
            results.extend(source_results)
        except Exception as exc:
            errors[source] = str(exc)

    status = "completed"
    if errors and results:
        status = "partial"
    elif errors and not results:
        status = "failed"

    return {
        "search_id": str(uuid4()),
        "query": request.query,
        "mode": request.mode,
        "status": status,
        "requested_sources": request.sources,
        "errors": errors or None,
        "results_count": len(results),
        "results": results,
    }

@app.get("/api/history")
async def get_history():
    return {"history": []}

@app.websocket("/ws/search")
async def websocket_search(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            
            await websocket.send_json({
                "type": "started",
                "message": "Search started",
                "query": data.get("query")
            })
            
            await asyncio.sleep(1)
            
            await websocket.send_json({
                "type": "result",
                "index": 0,
                "data": {
                    "title": "Test Result",
                    "url": "https://example.com",
                    "snippet": "Test snippet",
                    "source": "clearnet"
                }
            })
            
            await asyncio.sleep(1)
            
            await websocket.send_json({
                "type": "completed",
                "total_results": 1
            })
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
