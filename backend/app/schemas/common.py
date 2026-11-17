from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    app: str
    environment: str
    timestamp: datetime


class CategoryTemplate(BaseModel):
    slug: str
    name: str
    description: str
    default_base_points: int
    default_daily_cap: int
    supports_auto_sync: bool
    metadata_fields: list[str]
