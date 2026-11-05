from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class LocationItem(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    category: str
    description: Optional[str] = None


# Mock in-memory database
sample_locations: List[LocationItem] = [
    LocationItem(
        id=1,
        name="Central Park",
        latitude=40.785091,
        longitude=-73.968285,
        category="Park",
        description="Famous urban park in New York City",
    ),
    LocationItem(
        id=2,
        name="Golden Gate Bridge",
        latitude=37.819929,
        longitude=-122.478255,
        category="Landmark",
        description="Iconic suspension bridge in San Francisco",
    ),
    LocationItem(
        id=3,
        name="Eiffel Tower",
        latitude=48.858844,
        longitude=2.294351,
        category="Monument",
        description="Wrought-iron lattice tower in Paris",
    ),
]


@router.get("/items", response_model=List[LocationItem])
def get_items():
    return sample_locations


@router.get("/items/{item_id}", response_model=LocationItem)
def get_item(item_id: int):
    for item in sample_locations:
        if item.id == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")


@router.post("/items", response_model=LocationItem, status_code=201)
def create_item(item: LocationItem):
    for existing in sample_locations:
        if existing.id == item.id:
            raise HTTPException(status_code=400, detail="Item with this ID already exists")
    sample_locations.append(item)
    return item
