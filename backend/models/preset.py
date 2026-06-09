from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class PresetCreate(BaseModel):
    name: str
    module: str
    settings: Dict[str, Any]


class Preset(BaseModel):
    id: str
    name: str
    module: str
    settings: Dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
