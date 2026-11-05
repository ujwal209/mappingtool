"""
Transformation catalog models.

A "Transformation" is a reusable, named, versioned rule that can be
applied to one or more source columns and produces one target column.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import time
import uuid


class TransformCategory(str, Enum):
    """Group transforms in the UI by category."""
    DIRECT = "DIRECT"           # pass-through, cast
    STRING = "STRING"           # trim, case, regex, concat
    NUMERIC = "NUMERIC"         # math, rounding, currency
    DATE = "DATE"               # format, timezone, epoch
    SECURITY = "SECURITY"       # hash, mask, encrypt
    VALIDATION = "VALIDATION"   # regex check, enum, range
    LOOKUP = "LOOKUP"           # map_code, join, dictionary
    CONDITIONAL = "CONDITIONAL" # coalesce, if/then, default
    CUSTOM = "CUSTOM"           # user-defined


class TransformKind(str, Enum):
    """
    Built-in transforms are hand-written Python functions.
    Custom transforms are compiled from a safe expression DSL.
    """
    BUILTIN = "BUILTIN"
    CUSTOM_DSL = "CUSTOM_DSL"


class TransformParam(BaseModel):
    """Describes one parameter a transform accepts."""
    name: str
    label: str
    type: str = Field(
        default="string",
        description="string | int | float | bool | list<string> | json",
    )
    required: bool = False
    default: Optional[Any] = None
    description: str = ""
    enum_values: Optional[List[str]] = None


class Transformation(BaseModel):
    """One entry in the transformation catalog."""
    transform_id: str = Field(
        default_factory=lambda: f"tx-{uuid.uuid4().hex[:8]}"
    )
    tenant_id: str = "tenant-default"  # 'tenant-default' = global builtin

    # Identity
    key: str = Field(
        ...,
        description="Machine-readable identifier, e.g. 'trim' or 'upper_case'",
    )
    label: str = Field(..., description="Human-readable label")
    description: str = ""
    category: TransformCategory = TransformCategory.STRING
    kind: TransformKind = TransformKind.BUILTIN

    # Execution
    arity_min: int = Field(
        default=1,
        description="Minimum number of source columns required",
    )
    arity_max: int = Field(
        default=1,
        description="Maximum number of source columns accepted",
    )
    params: List[TransformParam] = Field(default_factory=list)

    # Custom-only: the DSL expression
    dsl_expression: Optional[str] = Field(
        None,
        description="For CUSTOM_DSL: the compiled expression, e.g. "
                    "'upper(trim(source[0]))'",
    )

    # Metadata
    example: Optional[str] = Field(
        None, description="'\"  hello  \" → \"Hello\"'"
    )
    is_active: bool = True
    is_system: bool = Field(
        default=False,
        description="True for the ~100 builtin transforms seeded at startup",
    )

    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)