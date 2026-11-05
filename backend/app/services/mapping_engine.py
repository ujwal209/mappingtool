import re
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from rapidfuzz import fuzz

# Common domain and metadata synonyms for attribute matching
SYNONYM_GROUPS = [
    {"id", "identifier", "code", "key", "number", "num", "no", "sku", "client_id", "account_id", "item_id", "customer_id"},
    {"name", "full_name", "title", "contact_name", "label", "person", "product_name", "client_name"},
    {"email", "email_address", "mail", "contact_email", "user_email"},
    {"phone", "telephone", "phone_num", "telephone_num", "mobile", "contact_phone", "cell"},
    {"company", "organization", "company_org", "firm", "business", "vendor", "supplier", "employer"},
    {"city", "city_location", "town", "municipality", "locality"},
    {"zip", "zip_code", "postal", "postal_code", "postcode", "zipcode"},
    {"price", "cost", "unit_price", "retail_price", "amount", "charge", "rate"},
    {"revenue", "spend", "annual_spend", "total_revenue", "sales", "gross_sales", "turnover"},
    {"qty", "quantity", "stock", "stock_qty", "inventory", "available_inventory", "units", "count"},
    {"date", "signup_date", "registered_on", "created_at", "joined_date", "timestamp", "order_date"},
    {"weight", "weight_kg", "mass", "gross_weight", "net_weight"},
    {"category", "category_name", "department", "type", "class", "group"},
    {"status", "state", "account_status", "active_flag"},
    # Metadata attributes synonyms
    {"source_system", "meta_source_system", "system_origin", "source_app", "data_source"},
    {"data_classification", "meta_data_classification", "data_governance_level", "classification", "security_tier"},
    {"record_hash", "meta_record_hash", "audit_checksum", "checksum", "hash_key"},
    {"audit_date", "meta_last_audited", "last_audited", "audited_at", "verification_date"},
    {"sync_status", "meta_sync_status", "verification_status", "validation_state", "sync_state"},
    {"warehouse_node", "meta_warehouse_node", "distribution_center", "fulfillment_center", "facility_code"},
]


def normalize_string(s: str) -> str:
    """Normalize string by removing symbols, camelCase split, and lowercase."""
    if not s:
        return ""
    # Strip meta_ prefix for comparison if present
    s_clean = re.sub(r"^meta[_\s]+", "", str(s), flags=re.IGNORECASE)
    # Split camelCase
    s_clean = re.sub(r"([a-z])([A-Z])", r"\1 \2", s_clean)
    # Replace non-alphanumeric with spaces
    s_clean = re.sub(r"[^a-zA-Z0-9]+", " ", s_clean)
    return s_clean.strip().lower()


def are_synonyms(word_a: str, word_b: str) -> bool:
    """Check if two tokens belong to the same semantic synonym group."""
    norm_a = normalize_string(word_a).replace(" ", "_")
    norm_b = normalize_string(word_b).replace(" ", "_")
    if norm_a == norm_b:
        return True
    for group in SYNONYM_GROUPS:
        clean_group = {normalize_string(item).replace(" ", "_") for item in group}
        if norm_a in clean_group and norm_b in clean_group:
            return True
    return False


def compute_column_similarity(source_col: str, target_col: str) -> float:
    """Compute semantic and fuzzy similarity score between 0.0 and 1.0."""
    norm_s = normalize_string(source_col)
    norm_t = normalize_string(target_col)

    # 1. Exact match
    if norm_s == norm_t:
        return 1.0

    # 2. Check full synonym match
    if are_synonyms(source_col, target_col):
        return 0.95

    # 3. Word token overlap & synonym token overlap
    tokens_s = set(norm_s.split())
    tokens_t = set(norm_t.split())

    if not tokens_s or not tokens_t:
        return 0.0

    exact_overlap = tokens_s.intersection(tokens_t)
    if exact_overlap:
        token_overlap_score = len(exact_overlap) / max(len(tokens_s), len(tokens_t))
    else:
        token_overlap_score = 0.0

    # Check cross-token synonyms
    synonym_hits = 0
    for ts in tokens_s:
        for tt in tokens_t:
            if are_synonyms(ts, tt):
                synonym_hits += 1
                break

    synonym_score = synonym_hits / max(len(tokens_s), len(tokens_t))

    # 4. RapidFuzz token string similarities
    token_sort = fuzz.token_sort_ratio(norm_s, norm_t) / 100.0
    token_set = fuzz.token_set_ratio(norm_s, norm_t) / 100.0
    partial_ratio = fuzz.partial_ratio(norm_s, norm_t) / 100.0

    combined_fuzzy = (token_sort * 0.4) + (token_set * 0.4) + (partial_ratio * 0.2)

    # Blend semantic synonym score with fuzzy score
    score = max(token_overlap_score * 0.9, synonym_score * 0.92, combined_fuzzy)
    return round(float(score), 4)


def infer_column_type(series: pd.Series) -> str:
    """Infer human-readable column data type."""
    dtype_str = str(series.dtype).lower()
    if "int" in dtype_str or "float" in dtype_str or "number" in dtype_str:
        return "number"
    elif "datetime" in dtype_str or "date" in dtype_str:
        return "date"
    elif "bool" in dtype_str:
        return "boolean"
    else:
        # Check if values look like numbers or dates
        sample_non_null = series.dropna().head(10)
        if len(sample_non_null) > 0:
            all_digits = all(isinstance(v, (int, float)) for v in sample_non_null)
            if all_digits:
                return "number"
        return "string"


def extract_schema_from_df(
    df: pd.DataFrame, filename: str = "data.xlsx", sheet_name: str = "Sheet1"
) -> Dict[str, Any]:
    """Extract schema metadata, column statistics, and sample rows from DataFrame."""
    columns_meta = []
    total_rows = len(df)

    for col in df.columns:
        series = df[col]
        non_null_count = int(series.count())
        null_count = total_rows - non_null_count
        inferred_type = infer_column_type(series)
        
        # Check if column is a metadata attribute
        col_str = str(col).lower()
        is_metadata = (
            col_str.startswith("meta_")
            or col_str.startswith("_")
            or "governance" in col_str
            or "audit" in col_str
            or "checksum" in col_str
            or "source_system" in col_str
        )

        # Get sample values (clean formatting)
        samples = []
        for val in series.dropna().unique()[:3]:
            if pd.isna(val):
                continue
            if isinstance(val, (int, float)):
                samples.append(float(val) if isinstance(val, float) else int(val))
            else:
                samples.append(str(val))

        columns_meta.append({
            "name": str(col),
            "data_type": inferred_type,
            "is_metadata": is_metadata,
            "total_count": total_rows,
            "non_null_count": non_null_count,
            "null_count": null_count,
            "null_rate": round(null_count / total_rows, 2) if total_rows > 0 else 0.0,
            "sample_values": samples,
        })

    # Sample top 100 rows formatted as records
    preview_records = df.head(100).replace({float("nan"): None}).to_dict(orient="records")

    return {
        "filename": filename,
        "sheet_name": sheet_name,
        "row_count": total_rows,
        "column_count": len(df.columns),
        "columns": columns_meta,
        "preview_data": preview_records,
    }


def compute_schema_mapping(
    source_schema: Dict[str, Any], target_schema: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Automatically compute best matching source column for each target column."""
    source_cols = [col["name"] for col in source_schema.get("columns", [])]
    target_cols = [col["name"] for col in target_schema.get("columns", [])]

    mappings = []

    for target_col in target_cols:
        best_source: Optional[str] = None
        best_score: float = 0.0
        all_candidates: List[Dict[str, Any]] = []

        for source_col in source_cols:
            sim = compute_column_similarity(source_col, target_col)
            all_candidates.append({
                "source_column": source_col,
                "score": sim,
                "confidence_pct": round(sim * 100, 1),
            })
            if sim > best_score:
                best_score = sim
                best_source = source_col

        # Sort candidates descending
        all_candidates.sort(key=lambda x: x["score"], reverse=True)

        confidence_pct = round(best_score * 100, 1)
        if best_score >= 0.85:
            match_status = "HIGH_CONFIDENCE"
        elif best_score >= 0.50:
            match_status = "MEDIUM_CONFIDENCE"
        else:
            match_status = "UNMATCHED"
            best_source = None  # Don't auto-assign low quality match

        mappings.append({
            "target_column": target_col,
            "matched_source_column": best_source,
            "confidence_score": best_score,
            "confidence_pct": confidence_pct,
            "match_status": match_status,
            "is_auto_mapped": best_source is not None,
            "default_value": None,
            "candidates": all_candidates[:5],
        })

    return mappings


def generate_replica_df(
    source_df: pd.DataFrame,
    target_columns: List[str],
    column_mapping: Dict[str, Optional[str]],
    default_values: Dict[str, Any],
) -> pd.DataFrame:
    """Generate the replica DataFrame with exact target schema columns populated by source data."""
    replica_data: Dict[str, List[Any]] = {}
    row_count = len(source_df)

    for target_col in target_columns:
        source_col = column_mapping.get(target_col)
        
        if source_col and source_col in source_df.columns:
            # Transfer mapped source values
            replica_data[target_col] = list(source_df[source_col].values)
        else:
            # Unmapped column: use default value if provided, else None
            default_val = default_values.get(target_col, None)
            replica_data[target_col] = [default_val] * row_count

    return pd.DataFrame(replica_data, columns=target_columns)
