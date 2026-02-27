from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
import os
from datetime import datetime
from dotenv import load_dotenv
from logging_config import get_logger

load_dotenv()

logger = get_logger(__name__)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = 'deepweb_search'

client = None
db = None

async def connect_to_mongo():
    global client, db
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await client.admin.command('ping')
        logger.info("Connected to MongoDB", extra={"mongo_url": MONGO_URL})
    except ConnectionFailure as e:
        logger.error("MongoDB connection failed", extra={"error": str(e)})
        db = None

async def close_mongo_connection():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")

def get_database():
    return db

# Collections
def get_searches_collection():
    return db.searches if db is not None else None

def get_results_collection():
    return db.results if db is not None else None

def get_analytics_collection():
    return db.analytics if db is not None else None

def get_saved_searches_collection():
    return db.saved_searches if db is not None else None