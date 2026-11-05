"""
Executor — maps a transform key to a Python callable.

The rule compiler emits a `compiled_plan` like:
    {"op": "trim", "source_cols": ["name"], "params": {}}

The transform worker calls `execute_transform(op, source_values, params)`
which dispatches to the right Python function here.

Custom DSL transforms go through `app.sdk.rules.dsl.evaluate_transformation_rule`
instead.
"""

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════
def _safe_str(v: Any) -> str:
    return "" if v is None else str(v)


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        if isinstance(v, (int, float)):
            return float(v)
        # Strip currency symbols and thousands separators
        s = re.sub(r"[^\d.\-]", "", str(v))
        return float(s) if s else None
    except (TypeError, ValueError):
        return None


def _to_datetime(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    try:
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(float(v), tz=timezone.utc)
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════
# DIRECT / CAST
# ═══════════════════════════════════════════════════════════════
def _t_identity(vals, params):
    return list(vals)


def _t_direct_cast(vals, params):
    return list(vals)


def _t_cast_int(vals, params):
    out = []
    for v in vals:
        try:
            out.append(int(float(v)) if v is not None else None)
        except (TypeError, ValueError):
            out.append(None)
    return out


def _t_cast_float(vals, params):
    return [_to_float(v) for v in vals]


def _t_cast_bool(vals, params):
    truthy = {"true", "1", "yes", "t", "y", "on"}
    return [_safe_str(v).lower() in truthy for v in vals]


def _t_cast_date(vals, params):
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(dt.date().isoformat() if dt else None)
    return out


# ═══════════════════════════════════════════════════════════════
# STRING
# ═══════════════════════════════════════════════════════════════
def _t_trim(vals, params):
    return [_safe_str(v).strip() for v in vals]


def _t_ltrim(vals, params):
    return [_safe_str(v).lstrip() for v in vals]


def _t_rtrim(vals, params):
    return [_safe_str(v).rstrip() for v in vals]


def _t_uppercase(vals, params):
    return [_safe_str(v).upper() for v in vals]


def _t_lowercase(vals, params):
    return [_safe_str(v).lower() for v in vals]


def _t_title_case(vals, params):
    return [_safe_str(v).title() for v in vals]


def _t_normalize_text(vals, params):
    return [" ".join(_safe_str(v).split()).title() for v in vals]


def _t_remove_whitespace(vals, params):
    return [re.sub(r"\s+", "", _safe_str(v)) for v in vals]


def _t_collapse_whitespace(vals, params):
    return [re.sub(r"\s+", " ", _safe_str(v)).strip() for v in vals]


def _t_replace(vals, params):
    find = params.get("find", "")
    repl = params.get("replace", "")
    if not find:
        return list(vals)
    return [_safe_str(v).replace(find, repl) for v in vals]


def _t_regex_replace(vals, params):
    pattern = params.get("pattern", "")
    repl = params.get("replace", "")
    if not pattern:
        return list(vals)
    rx = re.compile(pattern)
    return [rx.sub(repl, _safe_str(v)) for v in vals]


def _t_regex_extract(vals, params):
    pattern = params.get("pattern", "")
    group = int(params.get("group", 0))
    if not pattern:
        return [None] * len(vals)
    rx = re.compile(pattern)
    out = []
    for v in vals:
        m = rx.search(_safe_str(v))
        out.append(m.group(group) if m else None)
    return out


def _t_substring(vals, params):
    start = int(params.get("start", 0))
    end = params.get("end")
    out = []
    for v in vals:
        s = _safe_str(v)
        out.append(s[start:end] if end is not None else s[start:])
    return out


def _t_prefix(vals, params):
    p = params.get("value", "")
    return [f"{p}{_safe_str(v)}" for v in vals]


def _t_suffix(vals, params):
    s = params.get("value", "")
    return [f"{_safe_str(v)}{s}" for v in vals]


def _t_concat(vals, params):
    """Note: arity >= 2 — vals is a flat list of the source values."""
    sep = params.get("separator", " ")
    return [sep.join(_safe_str(v) for v in vals if v is not None)]


def _t_pad_left(vals, params):
    width = int(params.get("width", 0))
    char = params.get("char", "0")
    return [_safe_str(v).rjust(width, char) for v in vals]


def _t_pad_right(vals, params):
    width = int(params.get("width", 0))
    char = params.get("char", " ")
    return [_safe_str(v).ljust(width, char) for v in vals]


def _t_truncate(vals, params):
    max_length = int(params.get("max_length", 255))
    return [_safe_str(v)[:max_length] for v in vals]


def _t_reverse_string(vals, params):
    return [_safe_str(v)[::-1] for v in vals]


def _t_split_part(vals, params):
    delimiter = params.get("delimiter", ",")
    index = int(params.get("index", 0))
    out = []
    for v in vals:
        parts = _safe_str(v).split(delimiter)
        out.append(parts[index] if 0 <= index < len(parts) else None)
    return out


def _t_initials(vals, params):
    out = []
    for v in vals:
        s = _safe_str(v).strip()
        words = [w for w in s.split() if w]
        out.append("".join(w[0].upper() for w in words))
    return out


def _t_strip_punctuation(vals, params):
    return [re.sub(r"[^\w\s]", "", _safe_str(v)) for v in vals]


def _t_strip_html(vals, params):
    return [re.sub(r"<[^>]+>", "", _safe_str(v)) for v in vals]


def _t_slugify(vals, params):
    out = []
    for v in vals:
        s = _safe_str(v).lower().strip()
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
        s = re.sub(r"[^\w\s-]", "", s)
        s = re.sub(r"[-\s]+", "-", s).strip("-")
        out.append(s)
    return out


def _t_remove_accents(vals, params):
    out = []
    for v in vals:
        s = unicodedata.normalize("NFKD", _safe_str(v))
        out.append(s.encode("ascii", "ignore").decode("ascii"))
    return out


def _t_mask_email(vals, params):
    out = []
    for v in vals:
        s = _safe_str(v)
        if "@" in s:
            _, domain = s.split("@", 1)
            out.append(f"***@{domain}")
        else:
            out.append("****")
    return out


def _t_extract_domain(vals, params):
    out = []
    for v in vals:
        s = _safe_str(v)
        out.append(s.split("@", 1)[1] if "@" in s else None)
    return out


# ═══════════════════════════════════════════════════════════════
# NUMERIC
# ═══════════════════════════════════════════════════════════════
def _t_round(vals, params):
    decimals = int(params.get("decimals", 0))
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(round(f, decimals) if f is not None else None)
    return out


def _t_floor(vals, params):
    import math
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(math.floor(f) if f is not None else None)
    return out


def _t_ceil(vals, params):
    import math
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(math.ceil(f) if f is not None else None)
    return out


def _t_abs(vals, params):
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(abs(f) if f is not None else None)
    return out


def _t_negate(vals, params):
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(-f if f is not None else None)
    return out


def _t_multiply(vals, params):
    factor = float(params.get("factor", 1))
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(f * factor if f is not None else None)
    return out


def _t_divide(vals, params):
    divisor = float(params.get("divisor", 1))
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(f / divisor if (f is not None and divisor != 0) else None)
    return out


def _t_add_constant(vals, params):
    value = float(params.get("value", 0))
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(f + value if f is not None else None)
    return out


def _t_percent_of(vals, params):
    pct = float(params.get("percent", 0)) / 100.0
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(round(f * pct, 6) if f is not None else None)
    return out


def _t_currency_usd(vals, params):
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(f"${f:,.2f}" if f is not None else None)
    return out


def _t_clamp(vals, params):
    mn = params.get("min")
    mx = params.get("max")
    out = []
    for v in vals:
        f = _to_float(v)
        if f is None:
            out.append(None)
            continue
        if mn is not None and f < float(mn):
            f = float(mn)
        if mx is not None and f > float(mx):
            f = float(mx)
        out.append(f)
    return out


def _t_to_integer(vals, params):
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(int(f) if f is not None else None)
    return out


def _t_to_decimal(vals, params):
    scale = int(params.get("scale", 2))
    out = []
    for v in vals:
        f = _to_float(v)
        out.append(round(f, scale) if f is not None else None)
    return out


def _t_parse_number(vals, params):
    return [_to_float(v) for v in vals]


def _t_sum_columns(vals, params):
    # vals is a list of values from multiple source columns
    total = 0.0
    for v in vals:
        f = _to_float(v)
        if f is not None:
            total += f
    return [total]


# ═══════════════════════════════════════════════════════════════
# DATE
# ═══════════════════════════════════════════════════════════════
def _t_date_format(vals, params):
    fmt = params.get("format", "%Y-%m-%d")
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(dt.strftime(fmt) if dt else None)
    return out


def _t_date_parse(vals, params):
    fmt = params.get("format", "%Y-%m-%d")
    out = []
    for v in vals:
        if v is None:
            out.append(None)
            continue
        try:
            out.append(datetime.strptime(_safe_str(v), fmt).date().isoformat())
        except ValueError:
            out.append(None)
    return out


def _t_date_add_days(vals, params):
    days = int(params.get("days", 0))
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append((dt + timedelta(days=days)).date().isoformat() if dt else None)
    return out


def _t_date_subtract_days(vals, params):
    days = int(params.get("days", 0))
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append((dt - timedelta(days=days)).date().isoformat() if dt else None)
    return out


def _t_date_diff_days(vals, params):
    if len(vals) < 2:
        return [None]
    a = _to_datetime(vals[0])
    b = _to_datetime(vals[1])
    if a is None or b is None:
        return [None]
    return [(b - a).days]


def _t_date_to_epoch(vals, params):
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(int(dt.timestamp()) if dt else None)
    return out


def _t_epoch_to_date(vals, params):
    out = []
    for v in vals:
        f = _to_float(v)
        if f is None:
            out.append(None)
            continue
        try:
            out.append(datetime.fromtimestamp(f, tz=timezone.utc).date().isoformat())
        except (ValueError, OSError):
            out.append(None)
    return out


def _t_extract_year(vals, params):
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(dt.year if dt else None)
    return out


def _t_extract_month(vals, params):
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(dt.month if dt else None)
    return out


def _t_extract_day(vals, params):
    out = []
    for v in vals:
        dt = _to_datetime(v)
        out.append(dt.day if dt else None)
    return out


def _t_timezone_convert(vals, params):
    # Requires pytz or zoneinfo — kept minimal here
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        return list(vals)
    from_tz = params.get("from_tz", "UTC")
    to_tz = params.get("to_tz", "UTC")
    out = []
    for v in vals:
        dt = _to_datetime(v)
        if dt is None:
            out.append(None)
            continue
        try:
            dt_from = dt.replace(tzinfo=ZoneInfo(from_tz))
            out.append(dt_from.astimezone(ZoneInfo(to_tz)).isoformat())
        except Exception:
            out.append(None)
    return out


# ═══════════════════════════════════════════════════════════════
# SECURITY
# ═══════════════════════════════════════════════════════════════
def _t_hash_sha256(vals, params):
    return [hashlib.sha256(_safe_str(v).encode()).hexdigest() for v in vals]


def _t_hash_md5(vals, params):
    return [hashlib.md5(_safe_str(v).encode()).hexdigest() for v in vals]


def _t_mask(vals, params):
    out = []
    for v in vals:
        s = _safe_str(v)
        out.append("****" if len(s) <= 4 else f"{s[:2]}****{s[-2:]}")
    return out


def _t_mask_full(vals, params):
    return ["****" for _ in vals]


def _t_mask_phone(vals, params):
    out = []
    for v in vals:
        s = re.sub(r"\D", "", _safe_str(v))
        out.append(f"***-***-{s[-4:]}" if len(s) >= 4 else "****")
    return out


def _t_mask_ssn(vals, params):
    out = []
    for v in vals:
        s = re.sub(r"\D", "", _safe_str(v))
        out.append(f"***-**-{s[-4:]}" if len(s) >= 4 else "****")
    return out


def _t_mask_credit_card(vals, params):
    out = []
    for v in vals:
        s = re.sub(r"\D", "", _safe_str(v))
        out.append(f"****-****-****-{s[-4:]}" if len(s) >= 4 else "****")
    return out


def _t_tokenize(vals, params):
    salt = params.get("salt", "")
    out = []
    for v in vals:
        raw = f"{_safe_str(v)}{salt}"
        out.append(hashlib.sha256(raw.encode()).hexdigest()[:16])
    return out


# ═══════════════════════════════════════════════════════════════
# VALIDATION (returns (value, is_valid, error_msg) tuples via special path)
# ═══════════════════════════════════════════════════════════════
# Note: validation transforms don't transform — they set an error flag.
# The transform worker handles them specially by checking the returned
# (value, status) pair. For simplicity, we return the value unchanged
# and let the worker's validation pass inspect failures.
def _t_check_not_null(vals, params):
    return list(vals)


def _t_check_email(vals, params):
    return list(vals)


def _t_check_regex(vals, params):
    return list(vals)


def _t_check_range(vals, params):
    return list(vals)


def _t_check_length(vals, params):
    return list(vals)


def _t_check_enum(vals, params):
    return list(vals)


def _t_check_date_order(vals, params):
    return list(vals)


def _t_check_positive(vals, params):
    return list(vals)


def _t_check_unique(vals, params):
    return list(vals)


def _t_check_referential(vals, params):
    return list(vals)


# ═══════════════════════════════════════════════════════════════
# CONDITIONAL / LOOKUP
# ═══════════════════════════════════════════════════════════════
def _t_coalesce(vals, params):
    for v in vals:
        if v is not None and _safe_str(v).strip() != "":
            return [v]
    return [None]


def _t_default_if_null(vals, params):
    default = params.get("default")
    out = []
    for v in vals:
        out.append(v if v is not None else default)
    return out


def _t_default_if_empty(vals, params):
    default = params.get("default")
    out = []
    for v in vals:
        out.append(v if (v is not None and _safe_str(v).strip()) else default)
    return out


def _t_constant(vals, params):
    return [params.get("value")]


def _t_constant_literal(vals, params):
    return [params.get("value")]


def _t_replace_null(vals, params):
    value = params.get("value")
    return [v if v is not None else value for v in vals]


def _t_concat_coalesce(vals, params):
    sep = params.get("separator", " ")
    return [sep.join(_safe_str(v) for v in vals if v is not None and _safe_str(v).strip())]


def _t_boolean_and(vals, params):
    truthy = {"true", "1", "yes", "t", "y", "on"}
    return [all(_safe_str(v).lower() in truthy for v in vals)]


def _t_boolean_or(vals, params):
    truthy = {"true", "1", "yes", "t", "y", "on"}
    return [any(_safe_str(v).lower() in truthy for v in vals)]


def _t_boolean_not(vals, params):
    truthy = {"true", "1", "yes", "t", "y", "on"}
    return [_safe_str(v).lower() not in truthy for v in vals]


def _t_boolean_parse(vals, params):
    truthy = {"true", "1", "yes", "t", "y", "on"}
    return [_safe_str(v).lower() in truthy for v in vals]


def _t_if_then(vals, params):
    # Condition is evaluated at the rule-package layer before calling
    # this executor. Here we just select then/else based on the first
    # value's truthiness.
    cond = vals[0] if vals else None
    then_val = params.get("then")
    else_val = params.get("else")
    truthy = {"true", "1", "yes", "t", "y", "on"}
    is_true = _safe_str(cond).lower() in truthy or bool(cond)
    return [then_val if is_true else else_val]


def _t_map_code(vals, params):
    code_dict = params.get("code_dict", {}) or {}
    default = params.get("default")
    out = []
    for v in vals:
        key = _safe_str(v).strip()
        # Exact match first
        if key in code_dict:
            out.append(code_dict[key])
            continue
        # Case-insensitive fallback
        matched = None
        for k, val in code_dict.items():
            if k.lower() == key.lower():
                matched = val
                break
        out.append(matched if matched is not None else (default if default is not None else v))
    return out


# ═══════════════════════════════════════════════════════════════
# ROW / AGGREGATE
# ═══════════════════════════════════════════════════════════════
def _t_row_number(vals, params):
    # The worker supplies a row counter via params["_row_index"]
    return [params.get("_row_index", 0)]


def _t_running_total(vals, params):
    # The worker supplies a running accumulator via params["_running_total"]
    f = _to_float(vals[0]) if vals else None
    acc = params.get("_running_total", 0.0) or 0.0
    if f is not None:
        acc += f
    return [acc]


def _t_hash_row(vals, params):
    payload = json.dumps(list(vals), sort_keys=True, default=str)
    return [hashlib.sha256(payload.encode()).hexdigest()]


def _t_uuid_generate(vals, params):
    import uuid
    return [str(uuid.uuid4())]


# ═══════════════════════════════════════════════════════════════
# JSON
# ═══════════════════════════════════════════════════════════════
def _t_json_extract(vals, params):
    path = params.get("path", "")
    out = []
    for v in vals:
        try:
            obj = json.loads(_safe_str(v)) if isinstance(v, str) else v
        except (json.JSONDecodeError, TypeError):
            out.append(None)
            continue
        # Simple dot notation: 'a.b.c'
        cur = obj
        try:
            for part in path.split("."):
                if isinstance(cur, dict):
                    cur = cur.get(part)
                elif isinstance(cur, list) and part.isdigit():
                    cur = cur[int(part)]
                else:
                    cur = None
                    break
            out.append(cur)
        except Exception:
            out.append(None)
    return out


def _t_json_stringify(vals, params):
    out = []
    for v in vals:
        try:
            out.append(json.dumps(v, default=str))
        except (TypeError, ValueError):
            out.append(None)
    return out


def _t_json_parse(vals, params):
    out = []
    for v in vals:
        try:
            out.append(json.loads(_safe_str(v)))
        except (json.JSONDecodeError, TypeError):
            out.append(None)
    return out


def _t_json_array_join(vals, params):
    sep = params.get("separator", ",")
    out = []
    for v in vals:
        try:
            arr = json.loads(_safe_str(v)) if isinstance(v, str) else v
            if isinstance(arr, list):
                out.append(sep.join(_safe_str(x) for x in arr))
            else:
                out.append(None)
        except (json.JSONDecodeError, TypeError):
            out.append(None)
    return out


def _t_json_keys(vals, params):
    out = []
    for v in vals:
        try:
            obj = json.loads(_safe_str(v)) if isinstance(v, str) else v
            if isinstance(obj, dict):
                out.append(list(obj.keys()))
            else:
                out.append(None)
        except (json.JSONDecodeError, TypeError):
            out.append(None)
    return out


# ═══════════════════════════════════════════════════════════════
# Dispatch table
# ═══════════════════════════════════════════════════════════════
EXECUTORS: Dict[str, Callable[[List[Any], Dict[str, Any]], List[Any]]] = {
    # Direct
    "direct_cast": _t_direct_cast,
    "identity": _t_identity,
    "cast:int64": _t_cast_int,
    "cast:float": _t_cast_float,
    "cast:boolean": _t_cast_bool,
    "cast:date": _t_cast_date,

    # String
    "trim": _t_trim,
    "ltrim": _t_ltrim,
    "rtrim": _t_rtrim,
    "uppercase": _t_uppercase,
    "lowercase": _t_lowercase,
    "title_case": _t_title_case,
    "normalize_text": _t_normalize_text,
    "remove_whitespace": _t_remove_whitespace,
    "collapse_whitespace": _t_collapse_whitespace,
    "replace": _t_replace,
    "regex_replace": _t_regex_replace,
    "regex_extract": _t_regex_extract,
    "substring": _t_substring,
    "prefix": _t_prefix,
    "suffix": _t_suffix,
    "concat": _t_concat,
    "pad_left": _t_pad_left,
    "pad_right": _t_pad_right,
    "truncate": _t_truncate,
    "reverse_string": _t_reverse_string,
    "split_part": _t_split_part,
    "initials": _t_initials,
    "strip_punctuation": _t_strip_punctuation,
    "strip_html": _t_strip_html,
    "slugify": _t_slugify,
    "remove_accents": _t_remove_accents,
    "mask_email": _t_mask_email,
    "extract_domain": _t_extract_domain,

    # Numeric
    "round": _t_round,
    "floor": _t_floor,
    "ceil": _t_ceil,
    "abs": _t_abs,
    "negate": _t_negate,
    "multiply": _t_multiply,
    "divide": _t_divide,
    "add_constant": _t_add_constant,
    "percent_of": _t_percent_of,
    "currency_usd": _t_currency_usd,
    "clamp": _t_clamp,
    "to_integer": _t_to_integer,
    "to_decimal": _t_to_decimal,
    "parse_number": _t_parse_number,
    "sum_columns": _t_sum_columns,

    # Date
    "date_format": _t_date_format,
    "date_parse": _t_date_parse,
    "date_add_days": _t_date_add_days,
    "date_subtract_days": _t_date_subtract_days,
    "date_diff_days": _t_date_diff_days,
    "date_to_epoch": _t_date_to_epoch,
    "epoch_to_date": _t_epoch_to_date,
    "extract_year": _t_extract_year,
    "extract_month": _t_extract_month,
    "extract_day": _t_extract_day,
    "timezone_convert": _t_timezone_convert,

    # Security
    "hash_sha256": _t_hash_sha256,
    "hash_md5": _t_hash_md5,
    "mask": _t_mask,
    "mask_full": _t_mask_full,
    "mask_phone": _t_mask_phone,
    "mask_ssn": _t_mask_ssn,
    "mask_credit_card": _t_mask_credit_card,
    "tokenize": _t_tokenize,

    # Validation (pass-through — validation happens in validate_worker)
    "check_not_null": _t_check_not_null,
    "check_email": _t_check_email,
    "check_regex": _t_check_regex,
    "check_range": _t_check_range,
    "check_length": _t_check_length,
    "check_enum": _t_check_enum,
    "check_date_order": _t_check_date_order,
    "check_positive": _t_check_positive,
    "check_unique": _t_check_unique,
    "check_referential": _t_check_referential,

    # Conditional
    "coalesce": _t_coalesce,
    "default_if_null": _t_default_if_null,
    "default_if_empty": _t_default_if_empty,
    "constant": _t_constant,
    "constant_literal": _t_constant_literal,
    "replace_null": _t_replace_null,
    "concat_coalesce": _t_concat_coalesce,
    "if_then": _t_if_then,
    "map_code": _t_map_code,

    # Boolean
    "boolean_and": _t_boolean_and,
    "boolean_or": _t_boolean_or,
    "boolean_not": _t_boolean_not,
    "boolean_parse": _t_boolean_parse,

    # Row / aggregate
    "row_number": _t_row_number,
    "running_total": _t_running_total,
    "hash_row": _t_hash_row,
    "uuid_generate": _t_uuid_generate,

    # JSON
    "json_extract": _t_json_extract,
    "json_stringify": _t_json_stringify,
    "json_parse": _t_json_parse,
    "json_array_join": _t_json_array_join,
    "json_keys": _t_json_keys,
}


# ═══════════════════════════════════════════════════════════════
# Public entry point
# ═══════════════════════════════════════════════════════════════
def execute_transform(
    op: str,
    source_values: List[Any],
    params: Optional[Dict[str, Any]] = None,
) -> List[Any]:
    """
    Execute a built-in transform against a list of source values.

    For single-arity transforms (arity_max=1), `source_values` will have
    exactly one element and the returned list will have exactly one element.

    For multi-arity transforms (concat, sum_columns, etc.), all source
    values are passed together and the result is a single-element list.

    Raises KeyError if `op` is not registered.
    """
    fn = EXECUTORS.get(op)
    if fn is None:
        raise KeyError(f"Unknown transform op '{op}'")
    return fn(list(source_values), params or {})


def is_registered(op: str) -> bool:
    """True if `op` has a Python executor."""
    return op in EXECUTORS


def list_registered_ops() -> List[str]:
    """All executable transform keys."""
    return sorted(EXECUTORS.keys())