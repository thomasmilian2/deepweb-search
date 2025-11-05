from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Callable, Awaitable, Any, Optional
from datetime import datetime, timedelta
import asyncio
import time

from models import SearchRequest, SearchRecord, QueryAnalysis, SavedSearch
from database import (
    connect_to_mongo,
    close_mongo_connection,
    get_database,
    get_searches_collection,
    get_results_collection,
    get_analytics_collection,
    get_saved_searches_collection
)
from cache_service import cache
from query_analyzer import query_analyzer
from ranking_service import ranking_service
from sources import search_duckduckgo

app = FastAPI(title="DeepWeb Search API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_SOURCES: Dict[str, Callable[..., Awaitable[List[Dict[str, Any]]]]] = {
    "duckduckgo": search_duckduckgo,
}

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.get("/")
async def root():
    return {
        "service": "DeepWeb Search API",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Advanced query analysis",
            "Intelligent caching",
            "Result ranking & scoring",
            "Search history",
            "Analytics dashboard",
            "Saved searches"
        ]
    }

@app.get("/health")
async def health_check():
    try:
        db = get_database()
        db_status = "ok" if db is not None else "disconnected"
    except:
        db_status = "disconnected"
    return {
        "api": "ok",
        "database": db_status,
        "cache": cache.get_stats()
    }

@app.post("/api/analyze")
async def analyze_query(request: dict):
    """Analyze a search query to extract intent, keywords, and suggestions"""
    query = request.get("query", "")
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    analysis = query_analyzer.analyze(query)
    return {"analysis": analysis}

@app.post("/api/search")
async def search(request: SearchRequest, http_request: Request):
    """Main search endpoint with caching, ranking, and persistence"""
    start_time = time.time()
    
    if not request.sources:
        raise HTTPException(status_code=400, detail="At least one source must be selected.")
    
    # Check cache first
    cached_result = cache.get(
        request.query, 
        request.sources, 
        request.languages, 
        request.max_results
    )
    
    if cached_result:
        # Add cache hit marker
        cached_result["from_cache"] = True
        cached_result["cache_hit"] = True
        return cached_result
    
    # Perform search
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

    # Deduplicate results
    results = ranking_service.deduplicate_results(results)
    
    # Rank results
    results = ranking_service.rank_results(results, request.query)
    
    # Pagination
    total_results = len(results)
    start_idx = (request.page - 1) * request.page_size
    end_idx = start_idx + request.page_size
    paginated_results = results[start_idx:end_idx]
    
    status = "completed"
    if errors and results:
        status = "partial"
    elif errors and not results:
        status = "failed"

    duration_ms = (time.time() - start_time) * 1000
    
    response_data = {
        "search_id": None,
        "query": request.query,
        "mode": request.mode,
        "status": status,
        "requested_sources": request.sources,
        "errors": errors or None,
        "results_count": len(paginated_results),
        "total_results": total_results,
        "page": request.page,
        "page_size": request.page_size,
        "total_pages": (total_results + request.page_size - 1) // request.page_size,
        "results": paginated_results,
        "duration_ms": round(duration_ms, 2),
        "from_cache": False
    }
    
    # Save to cache
    cache.set(
        request.query,
        request.sources,
        request.languages,
        request.max_results,
        response_data
    )
    
    # Save to database
    try:
        searches_collection = get_searches_collection()
        if searches_collection is not None:
            search_record = SearchRecord(
                query=request.query,
                mode=request.mode,
                languages=request.languages,
                sources=request.sources,
                status=status,
                results_count=total_results,
                duration_ms=duration_ms,
                user_ip=http_request.client.host if http_request.client else None
            )
            result = await searches_collection.insert_one(search_record.model_dump())
            response_data["search_id"] = str(result.inserted_id)
            
            # Save results to results collection
            results_collection = get_results_collection()
            if results_collection is not None and results:
                results_with_search_id = [
                    {**r, "search_id": str(result.inserted_id), "timestamp": datetime.utcnow()}
                    for r in results
                ]
                await results_collection.insert_many(results_with_search_id)
    except Exception as e:
        print(f"Error saving to database: {e}")
    
    return response_data

@app.get("/api/history")
async def get_history(limit: int = 50, skip: int = 0):
    """Get search history with pagination"""
    try:
        searches_collection = get_searches_collection()
        if searches_collection is None:
            return {"history": [], "total": 0}
        
        # Get total count
        total = await searches_collection.count_documents({})
        
        # Get paginated results
        cursor = searches_collection.find().sort("timestamp", -1).skip(skip).limit(limit)
        history = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string for JSON serialization
        for item in history:
            if "_id" in item:
                item["_id"] = str(item["_id"])
        
        return {
            "history": history,
            "total": total,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        print(f"Error fetching history: {e}")
        return {"history": [], "total": 0}

@app.get("/api/analytics")
async def get_analytics(days: int = 7):
    """Get analytics for the dashboard"""
    try:
        searches_collection = get_searches_collection()
        if searches_collection is None:
            return {"error": "Database not connected"}
        
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Total searches
        total_searches = await searches_collection.count_documents({
            "timestamp": {"$gte": start_date}
        })
        
        # Searches by status
        pipeline_status = [
            {"$match": {"timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_results = await searches_collection.aggregate(pipeline_status).to_list(None)
        searches_by_status = {item["_id"]: item["count"] for item in status_results}
        
        # Top queries
        pipeline_queries = [
            {"$match": {"timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$query", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_queries_results = await searches_collection.aggregate(pipeline_queries).to_list(None)
        top_queries = [
            {"query": item["_id"], "count": item["count"]} 
            for item in top_queries_results
        ]
        
        # Searches by source
        pipeline_sources = [
            {"$match": {"timestamp": {"$gte": start_date}}},
            {"$unwind": "$sources"},
            {"$group": {"_id": "$sources", "count": {"$sum": 1}}}
        ]
        sources_results = await searches_collection.aggregate(pipeline_sources).to_list(None)
        searches_by_source = {item["_id"]: item["count"] for item in sources_results}
        
        # Searches over time (daily)
        pipeline_timeline = [
            {"$match": {"timestamp": {"$gte": start_date}}},
            {"$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}
                },
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        timeline_results = await searches_collection.aggregate(pipeline_timeline).to_list(None)
        searches_timeline = [
            {"date": item["_id"], "count": item["count"]}
            for item in timeline_results
        ]
        
        # Average duration
        pipeline_duration = [
            {"$match": {"timestamp": {"$gte": start_date}, "duration_ms": {"$exists": True}}},
            {"$group": {"_id": None, "avg_duration": {"$avg": "$duration_ms"}}}
        ]
        duration_results = await searches_collection.aggregate(pipeline_duration).to_list(None)
        avg_duration = duration_results[0]["avg_duration"] if duration_results else 0
        
        # Languages usage
        pipeline_languages = [
            {"$match": {"timestamp": {"$gte": start_date}}},
            {"$unwind": "$languages"},
            {"$group": {"_id": "$languages", "count": {"$sum": 1}}}
        ]
        languages_results = await searches_collection.aggregate(pipeline_languages).to_list(None)
        languages_usage = {item["_id"]: item["count"] for item in languages_results}
        
        return {
            "period_days": days,
            "total_searches": total_searches,
            "searches_by_status": searches_by_status,
            "top_queries": top_queries,
            "searches_by_source": searches_by_source,
            "searches_timeline": searches_timeline,
            "avg_duration_ms": round(avg_duration, 2) if avg_duration else 0,
            "languages_usage": languages_usage,
            "cache_stats": cache.get_stats()
        }
    except Exception as e:
        print(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/suggestions")
async def get_suggestions(q: str, limit: int = 5):
    """Get search suggestions based on query history"""
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    try:
        searches_collection = get_searches_collection()
        if searches_collection is None:
            return {"suggestions": []}
        
        # Find queries that start with or contain the input
        pipeline = [
            {"$match": {"query": {"$regex": f".*{q}.*", "$options": "i"}}},
            {"$group": {"_id": "$query", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        
        results = await searches_collection.aggregate(pipeline).to_list(None)
        suggestions = [item["_id"] for item in results]
        
        return {"suggestions": suggestions}
    except Exception as e:
        print(f"Error fetching suggestions: {e}")
        return {"suggestions": []}

@app.get("/api/related")
async def get_related_searches(query: str, limit: int = 5):
    """Get related searches based on query analysis"""
    if not query:
        return {"related": []}
    
    try:
        # Analyze the query
        analysis = query_analyzer.analyze(query)
        keywords = analysis["keywords"]
        
        searches_collection = get_searches_collection()
        if searches_collection is None or not keywords:
            return {"related": []}
        
        # Find queries with similar keywords
        keyword_regex = "|".join(keywords[:3])  # Use top 3 keywords
        pipeline = [
            {
                "$match": {
                    "query": {"$regex": keyword_regex, "$options": "i"},
                    "query": {"$ne": query}  # Exclude exact match
                }
            },
            {"$group": {"_id": "$query", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        
        results = await searches_collection.aggregate(pipeline).to_list(None)
        related = [item["_id"] for item in results]
        
        return {"related": related, "based_on_keywords": keywords[:3]}
    except Exception as e:
        print(f"Error fetching related searches: {e}")
        return {"related": []}

@app.post("/api/saved-searches")
async def save_search(saved_search: dict):
    """Save a search for later"""
    try:
        saved_searches_collection = get_saved_searches_collection()
        if saved_searches_collection is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        saved = SavedSearch(
            query=saved_search.get("query"),
            filters=saved_search.get("filters", {}),
            name=saved_search.get("name"),
            tags=saved_search.get("tags", [])
        )
        
        result = await saved_searches_collection.insert_one(saved.model_dump())
        
        return {
            "saved_id": saved.saved_id,
            "message": "Search saved successfully"
        }
    except Exception as e:
        print(f"Error saving search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/saved-searches")
async def get_saved_searches():
    """Get all saved searches"""
    try:
        saved_searches_collection = get_saved_searches_collection()
        if saved_searches_collection is None:
            return {"saved_searches": []}
        
        cursor = saved_searches_collection.find().sort("created_at", -1)
        saved_searches = await cursor.to_list(length=100)
        
        # Convert ObjectId to string
        for item in saved_searches:
            if "_id" in item:
                item["_id"] = str(item["_id"])
        
        return {"saved_searches": saved_searches}
    except Exception as e:
        print(f"Error fetching saved searches: {e}")
        return {"saved_searches": []}

@app.delete("/api/saved-searches/{saved_id}")
async def delete_saved_search(saved_id: str):
    """Delete a saved search"""
    try:
        saved_searches_collection = get_saved_searches_collection()
        if saved_searches_collection is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        result = await saved_searches_collection.delete_one({"saved_id": saved_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        return {"message": "Saved search deleted successfully"}
    except Exception as e:
        print(f"Error deleting saved search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/search")
async def websocket_search(websocket: WebSocket):
    """WebSocket endpoint for real-time search updates"""
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
                    "title": "Real-time Result",
                    "url": "https://example.com",
                    "snippet": "This is a real-time search result",
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