"""
Declarative Transformation DSL & Deterministic Rule Runtime.
Fulfills requirements from Section 11 (Transformation Engine) and TA-002 (Deterministic Replay).

Rules are pure deterministic functions without unpinned external or stochastic calls.
Every evaluation returns value + status metadata (OK, WARNING, REJECT, ERROR).
"""

import re
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field


class RuleEvaluationStatus(str, Enum):
    OK = "OK"
    WARNING = "WARNING"
    REJECT = "REJECT"
    ERROR = "ERROR"


class RuleOutput(BaseModel):
    value: Any
    status: RuleEvaluationStatus = RuleEvaluationStatus.OK
    reason_code: Optional[str] = None
    applied_op: str = "direct"


# ==========================================
# Pure Deterministic Primitive Operations
# ==========================================

def op_trim(val: Any) -> RuleOutput:
    if val is None:
        return RuleOutput(value=None, status=RuleEvaluationStatus.OK, applied_op="trim")
    return RuleOutput(value=str(val).strip(), status=RuleEvaluationStatus.OK, applied_op="trim")


def op_cast(val: Any, target_type: str) -> RuleOutput:
    if val is None or (isinstance(val, str) and not val.strip()):
        return RuleOutput(value=None, status=RuleEvaluationStatus.OK, applied_op="cast")
    t = (target_type or "").lower().strip()
    try:
        if t in ("int", "integer", "bigint", "tinyint", "smallint", "mediumint"):
            if isinstance(val, bool):
                return RuleOutput(value=1 if val else 0, status=RuleEvaluationStatus.OK, applied_op="cast")
            cleaned = re.sub(r"[^\d.-]", "", str(val))
            return RuleOutput(value=int(round(float(cleaned))) if cleaned else 0, status=RuleEvaluationStatus.OK, applied_op="cast")
        elif t in ("float", "double", "decimal", "numeric"):
            cleaned = re.sub(r"[^\d.-]", "", str(val))
            return RuleOutput(value=float(cleaned) if cleaned else 0.0, status=RuleEvaluationStatus.OK, applied_op="cast")
        elif t in ("bool", "boolean", "bit"):
            str_val = str(val).lower().strip()
            return RuleOutput(value=str_val in ("true", "1", "yes", "t", "y"), status=RuleEvaluationStatus.OK, applied_op="cast")
        elif t in ("datetime", "timestamp"):
            val_str = str(val).strip()
            if isinstance(val, (int, float)) or (val_str.isdigit() and len(val_str) >= 9):
                epoch = float(val)
                if epoch > 1e11:
                    epoch = epoch / 1000.0
                dt = datetime.fromtimestamp(epoch, timezone.utc)
                return RuleOutput(value=dt.strftime("%Y-%m-%d %H:%M:%S"), status=RuleEvaluationStatus.OK, applied_op="cast")
            cleaned_dt = val_str.replace("T", " ").replace("Z", "")
            if "+" in cleaned_dt:
                cleaned_dt = cleaned_dt.split("+")[0]
            if "." in cleaned_dt and len(cleaned_dt.split(".")[1]) > 6:
                cleaned_dt = cleaned_dt.split(".")[0]
            return RuleOutput(value=cleaned_dt.strip(), status=RuleEvaluationStatus.OK, applied_op="cast")
        elif t == "date":
            val_str = str(val).strip()
            if isinstance(val, (int, float)) or (val_str.isdigit() and len(val_str) >= 9):
                epoch = float(val)
                if epoch > 1e11:
                    epoch = epoch / 1000.0
                dt = datetime.fromtimestamp(epoch, timezone.utc)
                return RuleOutput(value=dt.strftime("%Y-%m-%d"), status=RuleEvaluationStatus.OK, applied_op="cast")
            return RuleOutput(value=val_str[:10], status=RuleEvaluationStatus.OK, applied_op="cast")
        elif t in ("str", "string", "varchar", "text", "char"):
            return RuleOutput(value=str(val), status=RuleEvaluationStatus.OK, applied_op="cast")
        return RuleOutput(value=val, status=RuleEvaluationStatus.OK, applied_op="cast")
    except Exception as e:
        return RuleOutput(
            value=val,
            status=RuleEvaluationStatus.ERROR,
            reason_code="CAST_FAILURE",
            applied_op="cast"
        )


def op_normalize_text(val: Any) -> RuleOutput:
    if val is None:
        return RuleOutput(value=None, status=RuleEvaluationStatus.OK, applied_op="normalize_text")
    s = str(val).strip()
    s = re.sub(r"\s+", " ", s)
    return RuleOutput(value=s.title(), status=RuleEvaluationStatus.OK, applied_op="normalize_text")


def op_coalesce(val: Any, default_val: Any) -> RuleOutput:
    if val is None or (isinstance(val, str) and not val.strip()):
        return RuleOutput(value=default_val, status=RuleEvaluationStatus.WARNING, reason_code="COALESCED_DEFAULT", applied_op="coalesce")
    return RuleOutput(value=val, status=RuleEvaluationStatus.OK, applied_op="coalesce")


def op_hash(val: Any) -> RuleOutput:
    if val is None:
        return RuleOutput(value=None, status=RuleEvaluationStatus.OK, applied_op="hash")
    h = hashlib.sha256(str(val).encode("utf-8")).hexdigest()
    return RuleOutput(value=h, status=RuleEvaluationStatus.OK, applied_op="hash")


def op_mask(val: Any) -> RuleOutput:
    if val is None:
        return RuleOutput(value=None, status=RuleEvaluationStatus.OK, applied_op="mask")
    s = str(val)
    if len(s) <= 4:
        return RuleOutput(value="****", status=RuleEvaluationStatus.OK, applied_op="mask")
    return RuleOutput(value=f"{s[:2]}****{s[-2:]}", status=RuleEvaluationStatus.OK, applied_op="mask")


def op_concat(values: List[Any], separator: str = " ") -> RuleOutput:
    clean_parts = [str(v).strip() for v in values if v is not None and str(v).strip()]
    return RuleOutput(value=separator.join(clean_parts), status=RuleEvaluationStatus.OK, applied_op="concat")


def op_map_code(val: Any, code_dictionary: Dict[str, Any], default: Any = None) -> RuleOutput:
    if val is None:
        return RuleOutput(value=default, status=RuleEvaluationStatus.OK, applied_op="map_code")
    str_key = str(val).strip()
    if str_key in code_dictionary:
        return RuleOutput(value=code_dictionary[str_key], status=RuleEvaluationStatus.OK, applied_op="map_code")
    # Case-insensitive search
    for k, v in code_dictionary.items():
        if k.lower() == str_key.lower():
            return RuleOutput(value=v, status=RuleEvaluationStatus.OK, applied_op="map_code")
    return RuleOutput(
        value=default if default is not None else val,
        status=RuleEvaluationStatus.WARNING if default is not None else RuleEvaluationStatus.REJECT,
        reason_code="UNMAPPED_CODE",
        applied_op="map_code"
    )


# ==========================================
# Deterministic Expression Evaluator
# ==========================================

def evaluate_transformation_rule(
    rule_spec: Dict[str, Any],
    source_record: Dict[str, Any],
    manifest_constants: Optional[Dict[str, Any]] = None
) -> RuleOutput:
    """
    Evaluates a single compiled rule against a source record deterministically.
    Manifest constants provide pinned values (e.g. execution_timestamp) to avoid non-determinism.
    """
    op = rule_spec.get("op", "direct")
    src_cols = rule_spec.get("source_cols", [])
    default_val = rule_spec.get("default", None)
    
    # Retrieve raw source value(s)
    if not src_cols:
        return op_coalesce(None, default_val)
        
    primary_src = src_cols[0]
    raw_val = source_record.get(primary_src)

    if op in ("direct", "direct_cast"):
        target_type = rule_spec.get("target_type")
        if target_type and target_type.lower() not in ("string", "str", "varchar", "text", "char"):
            casted = op_cast(raw_val, target_type)
            if casted.value is not None:
                return casted
        return op_coalesce(raw_val, default_val)
    elif op == "trim":
        return op_trim(raw_val)
    elif op in ("cast", "type_cast"):
        target_type = rule_spec.get("target_type", "string")
        casted = op_cast(raw_val, target_type)
        return casted if casted.value is not None else op_coalesce(None, default_val)
    elif op in ("uppercase", "upper"):
        if raw_val is None:
            return op_coalesce(None, default_val)
        return RuleOutput(value=str(raw_val).upper(), status=RuleEvaluationStatus.OK, applied_op="uppercase")
    elif op in ("lowercase", "lower"):
        if raw_val is None:
            return op_coalesce(None, default_val)
        return RuleOutput(value=str(raw_val).lower(), status=RuleEvaluationStatus.OK, applied_op="lowercase")
    elif op in ("cents_to_dollars", "divide_by_100"):
        if raw_val is None:
            return op_coalesce(None, default_val)
        try:
            cleaned = re.sub(r"[^\d.-]", "", str(raw_val))
            val_flt = round(float(cleaned) / 100.0, 2)
            return RuleOutput(value=val_flt, status=RuleEvaluationStatus.OK, applied_op="cents_to_dollars")
        except Exception:
            return op_coalesce(raw_val, default_val)
    elif op in ("epoch_to_datetime", "from_epoch", "timestamp_to_datetime"):
        casted = op_cast(raw_val, "datetime")
        return casted if casted.value is not None else op_coalesce(None, default_val)
    elif op == "normalize_text":
        return op_normalize_text(raw_val)
    elif op == "hash":
        return op_hash(raw_val)
    elif op == "mask":
        return op_mask(raw_val)
    elif op == "concat":
        parts = [source_record.get(col) for col in src_cols]
        sep = rule_spec.get("separator", " ")
        return op_concat(parts, sep)
    elif op == "map_code":
        code_dict = rule_spec.get("code_dict", {})
        return op_map_code(raw_val, code_dict, default_val)
    elif op == "constant":
        const_val = rule_spec.get("value")
        if const_val is None and manifest_constants:
            const_val = manifest_constants.get(rule_spec.get("constant_key"))
        return RuleOutput(value=const_val, status=RuleEvaluationStatus.OK, applied_op="constant")
    
    return op_coalesce(raw_val, default_val)
