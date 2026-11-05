"""
Declarative list of all built-in transforms.
Seeded into the DB on startup if not present.
"""

from app.models.transformations import (
    TransformCategory, TransformKind, TransformParam, Transformation,
)


def _p(name, label, type_="string", required=False, default=None,
       description="", enum_values=None):
    return TransformParam(
        name=name, label=label, type=type_, required=required,
        default=default, description=description, enum_values=enum_values,
    )


# ═══════════════════════════════════════════════════════════════════
# Builtin catalog — 100+ transforms grouped by category
# ═══════════════════════════════════════════════════════════════════

BUILTIN_TRANSFORMS: list[dict] = [

    # ── DIRECT (5) ─────────────────────────────────────────────
    {"key": "direct_cast", "label": "Direct cast",
     "description": "Copy the value as-is, adapting only the datatype.",
     "category": TransformCategory.DIRECT, "example": "123 → 123"},

    {"key": "identity", "label": "Identity",
     "description": "Pass through unchanged.",
     "category": TransformCategory.DIRECT, "example": "abc → abc"},

    {"key": "cast:int64", "label": "Cast to integer",
     "description": "Convert to 64-bit signed integer.",
     "category": TransformCategory.DIRECT, "example": '"42" → 42'},

    {"key": "cast:float", "label": "Cast to float",
     "description": "Convert to floating-point.",
     "category": TransformCategory.DIRECT, "example": '"3.14" → 3.14'},

    {"key": "cast:boolean", "label": "Cast to boolean",
     "description": "Interpret truthy/falsy strings.",
     "category": TransformCategory.DIRECT, "example": '"yes" → true'},

    # ── STRING (30) ────────────────────────────────────────────
    {"key": "trim", "label": "Trim whitespace",
     "description": "Strip leading and trailing whitespace.",
     "category": TransformCategory.STRING, "example": '"  hi  " → "hi"'},

    {"key": "ltrim", "label": "Trim left",
     "description": "Strip leading whitespace only.",
     "category": TransformCategory.STRING},

    {"key": "rtrim", "label": "Trim right",
     "description": "Strip trailing whitespace only.",
     "category": TransformCategory.STRING},

    {"key": "uppercase", "label": "Uppercase",
     "description": "Convert to upper case.",
     "category": TransformCategory.STRING, "example": "abc → ABC"},

    {"key": "lowercase", "label": "Lowercase",
     "description": "Convert to lower case.",
     "category": TransformCategory.STRING, "example": "ABC → abc"},

    {"key": "title_case", "label": "Title case",
     "description": "Capitalize each word.",
     "category": TransformCategory.STRING, "example": '"alice smith" → "Alice Smith"'},

    {"key": "normalize_text", "label": "Normalize text",
     "description": "Collapse whitespace, strip, title case.",
     "category": TransformCategory.STRING},

    {"key": "remove_whitespace", "label": "Remove all whitespace",
     "description": "Remove every space, tab, newline.",
     "category": TransformCategory.STRING},

    {"key": "collapse_whitespace", "label": "Collapse whitespace",
     "description": "Replace runs of whitespace with a single space.",
     "category": TransformCategory.STRING},

    {"key": "replace", "label": "Replace",
     "description": "Replace occurrences of a substring.",
     "category": TransformCategory.STRING,
     "params": [_p("find", "Find", required=True),
                _p("replace", "Replace with", required=True)]},

    {"key": "regex_replace", "label": "Regex replace",
     "description": "Replace text matching a regex pattern.",
     "category": TransformCategory.STRING,
     "params": [_p("pattern", "Regex pattern", required=True),
                _p("replace", "Replacement", required=True)]},

    {"key": "regex_extract", "label": "Regex extract",
     "description": "Extract the first match of a regex.",
     "category": TransformCategory.STRING,
     "params": [_p("pattern", "Regex pattern", required=True),
                _p("group", "Group index", type_="int", default=0)]},

    {"key": "substring", "label": "Substring",
     "description": "Extract a substring by index.",
     "category": TransformCategory.STRING,
     "params": [_p("start", "Start index", type_="int", required=True),
                _p("end", "End index", type_="int")]},

    {"key": "prefix", "label": "Add prefix",
     "description": "Prepend a string.",
     "category": TransformCategory.STRING,
     "params": [_p("value", "Prefix", required=True)]},

    {"key": "suffix", "label": "Add suffix",
     "description": "Append a string.",
     "category": TransformCategory.STRING,
     "params": [_p("value", "Suffix", required=True)]},

    {"key": "concat", "label": "Concatenate",
     "description": "Join multiple source columns with a separator.",
     "category": TransformCategory.STRING, "arity_min": 2, "arity_max": 10,
     "params": [_p("separator", "Separator", default=" ")]},

    {"key": "pad_left", "label": "Pad left",
     "description": "Pad to a fixed width on the left.",
     "category": TransformCategory.STRING,
     "params": [_p("width", "Width", type_="int", required=True),
                _p("char", "Pad char", default="0")]},

    {"key": "pad_right", "label": "Pad right",
     "description": "Pad to a fixed width on the right.",
     "category": TransformCategory.STRING,
     "params": [_p("width", "Width", type_="int", required=True),
                _p("char", "Pad char", default=" ")]},

    {"key": "truncate", "label": "Truncate",
     "description": "Truncate to max length.",
     "category": TransformCategory.STRING,
     "params": [_p("max_length", "Max length", type_="int", required=True)]},

    {"key": "reverse_string", "label": "Reverse",
     "description": "Reverse the characters.",
     "category": TransformCategory.STRING},

    {"key": "split_part", "label": "Split and take part",
     "description": "Split on a delimiter and return the nth part.",
     "category": TransformCategory.STRING,
     "params": [_p("delimiter", "Delimiter", required=True),
                _p("index", "Index", type_="int", required=True)]},

    {"key": "initials", "label": "Initials",
     "description": "Extract initials from a name.",
     "category": TransformCategory.STRING, "example": '"Alice Smith" → "AS"'},

    {"key": "strip_punctuation", "label": "Strip punctuation",
     "description": "Remove all punctuation characters.",
     "category": TransformCategory.STRING},

    {"key": "strip_html", "label": "Strip HTML",
     "description": "Remove HTML tags.",
     "category": TransformCategory.STRING},

    {"key": "slugify", "label": "Slugify",
     "description": "Convert to URL-safe slug.",
     "category": TransformCategory.STRING, "example": '"Hello World!" → "hello-world"'},

    {"key": "remove_accents", "label": "Remove accents",
     "description": "Normalize accented characters to ASCII.",
     "category": TransformCategory.STRING, "example": '"café" → "cafe"'},

    {"key": "mask_email", "label": "Mask email",
     "description": "Hide the local part of an email.",
     "category": TransformCategory.STRING, "example": '"a@b.com" → "***@b.com"'},

    {"key": "extract_domain", "label": "Extract email domain",
     "description": "Return the domain part of an email.",
     "category": TransformCategory.STRING, "example": '"a@b.com" → "b.com"'},

    # ── NUMERIC (15) ───────────────────────────────────────────
    {"key": "round", "label": "Round",
     "description": "Round to N decimal places.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("decimals", "Decimals", type_="int", default=0)]},

    {"key": "floor", "label": "Floor",
     "description": "Round down to integer.",
     "category": TransformCategory.NUMERIC},

    {"key": "ceil", "label": "Ceiling",
     "description": "Round up to integer.",
     "category": TransformCategory.NUMERIC},

    {"key": "abs", "label": "Absolute value",
     "description": "Take absolute value.",
     "category": TransformCategory.NUMERIC},

    {"key": "negate", "label": "Negate",
     "description": "Multiply by -1.",
     "category": TransformCategory.NUMERIC},

    {"key": "multiply", "label": "Multiply",
     "description": "Multiply by a constant.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("factor", "Factor", type_="float", required=True)]},

    {"key": "divide", "label": "Divide",
     "description": "Divide by a constant.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("divisor", "Divisor", type_="float", required=True)]},

    {"key": "add_constant", "label": "Add constant",
     "description": "Add a constant value.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("value", "Value", type_="float", required=True)]},

    {"key": "percent_of", "label": "Percent of",
     "description": "Multiply by a percentage.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("percent", "Percent", type_="float", required=True)]},

    {"key": "currency_usd", "label": "Format as USD",
     "description": "Format as $1,234.56.",
     "category": TransformCategory.NUMERIC},

    {"key": "clamp", "label": "Clamp range",
     "description": "Clamp value to a min/max range.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("min", "Min", type_="float"),
                _p("max", "Max", type_="float")]},

    {"key": "to_integer", "label": "To integer",
     "description": "Truncate to integer.",
     "category": TransformCategory.NUMERIC},

    {"key": "to_decimal", "label": "To decimal",
     "description": "Convert to decimal with precision.",
     "category": TransformCategory.NUMERIC,
     "params": [_p("scale", "Scale", type_="int", default=2)]},

    {"key": "parse_number", "label": "Parse number",
     "description": "Extract digits from a mixed string.",
     "category": TransformCategory.NUMERIC,
     "example": '"$1,234.56" → 1234.56'},

    {"key": "sum_columns", "label": "Sum columns",
     "description": "Sum multiple numeric source columns.",
     "category": TransformCategory.NUMERIC, "arity_min": 2, "arity_max": 10},

    # ── DATE (12) ──────────────────────────────────────────────
    {"key": "cast:date", "label": "Cast to date",
     "description": "Parse to ISO-8601 date.",
     "category": TransformCategory.DATE, "example": '"2024-01-05" → 2024-01-05'},

    {"key": "date_format", "label": "Format date",
     "description": "Format a date with a strftime pattern.",
     "category": TransformCategory.DATE,
     "params": [_p("format", "Pattern", default="%Y-%m-%d")]},

    {"key": "date_parse", "label": "Parse date",
     "description": "Parse a string with a strptime pattern.",
     "category": TransformCategory.DATE,
     "params": [_p("format", "Pattern", required=True)]},

    {"key": "date_add_days", "label": "Add days",
     "description": "Add N days to a date.",
     "category": TransformCategory.DATE,
     "params": [_p("days", "Days", type_="int", required=True)]},

    {"key": "date_subtract_days", "label": "Subtract days",
     "description": "Subtract N days from a date.",
     "category": TransformCategory.DATE,
     "params": [_p("days", "Days", type_="int", required=True)]},

    {"key": "date_diff_days", "label": "Days between",
     "description": "Days between two date columns.",
     "category": TransformCategory.DATE, "arity_min": 2, "arity_max": 2},

    {"key": "date_to_epoch", "label": "To epoch seconds",
     "description": "Convert a date to Unix epoch seconds.",
     "category": TransformCategory.DATE},

    {"key": "epoch_to_date", "label": "From epoch",
     "description": "Convert epoch seconds to ISO date.",
     "category": TransformCategory.DATE},

    {"key": "extract_year", "label": "Extract year",
     "description": "Extract the year component.",
     "category": TransformCategory.DATE},

    {"key": "extract_month", "label": "Extract month",
     "description": "Extract the month component.",
     "category": TransformCategory.DATE},

    {"key": "extract_day", "label": "Extract day",
     "description": "Extract the day component.",
     "category": TransformCategory.DATE},

    {"key": "timezone_convert", "label": "Timezone convert",
     "description": "Convert between timezones.",
     "category": TransformCategory.DATE,
     "params": [_p("from_tz", "From TZ", required=True),
                _p("to_tz", "To TZ", required=True)]},

    # ── SECURITY (8) ───────────────────────────────────────────
    {"key": "hash_sha256", "label": "Hash SHA-256",
     "description": "One-way hash. Irreversible.",
     "category": TransformCategory.SECURITY, "example": '"x" → "2bb80d…"'},

    {"key": "hash_md5", "label": "Hash MD5",
     "description": "Fast non-cryptographic hash. Legacy only.",
     "category": TransformCategory.SECURITY},

    {"key": "mask", "label": "Mask value",
     "description": "Show only first 2 and last 2 chars.",
     "category": TransformCategory.SECURITY, "example": '"secret" → "se**et"'},

    {"key": "mask_full", "label": "Full mask",
     "description": "Replace with ****.",
     "category": TransformCategory.SECURITY},

    {"key": "mask_phone", "label": "Mask phone",
     "description": "Keep only last 4 digits.",
     "category": TransformCategory.SECURITY},

    {"key": "mask_ssn", "label": "Mask SSN",
     "description": "Show last 4 of SSN.",
     "category": TransformCategory.SECURITY},

    {"key": "mask_credit_card", "label": "Mask credit card",
     "description": "Show last 4 of card number.",
     "category": TransformCategory.SECURITY},

    {"key": "tokenize", "label": "Tokenize",
     "description": "Replace with a deterministic token (SHA-256 of value + salt).",
     "category": TransformCategory.SECURITY,
     "params": [_p("salt", "Salt", required=True)]},

    # ── VALIDATION (10) ────────────────────────────────────────
    {"key": "check_not_null", "label": "Require non-null",
     "description": "Fail if value is null.",
     "category": TransformCategory.VALIDATION},

    {"key": "check_email", "label": "Validate email",
     "description": "Fail if not a valid email address.",
     "category": TransformCategory.VALIDATION},

    {"key": "check_regex", "label": "Validate regex",
     "description": "Fail if value doesn't match a pattern.",
     "category": TransformCategory.VALIDATION,
     "params": [_p("pattern", "Regex", required=True)]},

    {"key": "check_range", "label": "Validate range",
     "description": "Fail if numeric value is outside a range.",
     "category": TransformCategory.VALIDATION,
     "params": [_p("min", "Min", type_="float"),
                _p("max", "Max", type_="float")]},

    {"key": "check_length", "label": "Validate length",
     "description": "Fail if length is outside a range.",
     "category": TransformCategory.VALIDATION,
     "params": [_p("min", "Min length", type_="int"),
                _p("max", "Max length", type_="int")]},

    {"key": "check_enum", "label": "Validate enum",
     "description": "Fail if value not in the allowed set.",
     "category": TransformCategory.VALIDATION,
     "params": [_p("values", "Allowed values", type_="list<string>", required=True)]},

    {"key": "check_date_order", "label": "Validate date order",
     "description": "Fail if first date is after second.",
     "category": TransformCategory.VALIDATION, "arity_min": 2, "arity_max": 2},

    {"key": "check_positive", "label": "Require positive",
     "description": "Fail if value <= 0.",
     "category": TransformCategory.VALIDATION},

    {"key": "check_unique", "label": "Require unique",
     "description": "Flag duplicates across the whole dataset.",
     "category": TransformCategory.VALIDATION},

    {"key": "check_referential", "label": "Require referential integrity",
     "description": "Fail if value doesn't exist in the parent table.",
     "category": TransformCategory.VALIDATION,
     "params": [_p("parent_table", "Parent table", required=True),
                _p("parent_column", "Parent column", required=True)]},

    # ── CONDITIONAL / LOOKUP (8) ───────────────────────────────
    {"key": "coalesce", "label": "Coalesce",
     "description": "Return the first non-null across multiple columns.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 1, "arity_max": 5},

    {"key": "default_if_null", "label": "Default if null",
     "description": "Use a default if value is null.",
     "category": TransformCategory.CONDITIONAL,
     "params": [_p("default", "Default value", required=True)]},

    {"key": "default_if_empty", "label": "Default if empty",
     "description": "Use a default if value is empty.",
     "category": TransformCategory.CONDITIONAL,
     "params": [_p("default", "Default value", required=True)]},

    {"key": "constant", "label": "Constant",
     "description": "Ignore source, emit a fixed value.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 0, "arity_max": 0,
     "params": [_p("value", "Constant value", required=True)]},

    {"key": "if_then", "label": "If / then",
     "description": "If condition matches, return one value; else another.",
     "category": TransformCategory.CONDITIONAL,
     "params": [_p("condition", "Condition (DSL)", required=True),
                _p("then", "Value if true", required=True),
                _p("else", "Value if false")]},

    {"key": "map_code", "label": "Map code",
     "description": "Look up the value in a code dictionary.",
     "category": TransformCategory.LOOKUP,
     "params": [_p("code_dict", "Code dictionary", type_="json", required=True),
                _p("default", "Fallback value")]},

    {"key": "replace_null", "label": "Replace null",
     "description": "Replace null with a specified value.",
     "category": TransformCategory.CONDITIONAL,
     "params": [_p("value", "Replacement", required=True)]},

    {"key": "concat_coalesce", "label": "Concat with coalesce",
     "description": "Concat multiple columns, skipping nulls.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 2, "arity_max": 10,
     "params": [_p("separator", "Separator", default=" ")]},

    # ── ROW / AGGREGATE (5) ────────────────────────────────────
    {"key": "row_number", "label": "Row number",
     "description": "Sequential number per row.",
     "category": TransformCategory.NUMERIC, "arity_min": 0, "arity_max": 0},

    {"key": "constant_literal", "label": "Constant literal",
     "description": "Same as constant but auto-typed.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 0, "arity_max": 0},

    {"key": "running_total", "label": "Running total",
     "description": "Cumulative sum across rows.",
     "category": TransformCategory.NUMERIC},

    {"key": "hash_row", "label": "Hash entire row",
     "description": "SHA-256 over all source columns.",
     "category": TransformCategory.SECURITY, "arity_min": 1, "arity_max": 20},

    {"key": "uuid_generate", "label": "Generate UUID",
     "description": "Generate a UUID per row.",
     "category": TransformCategory.SECURITY, "arity_min": 0, "arity_max": 0},

    # ── JSON (5) ───────────────────────────────────────────────
    {"key": "json_extract", "label": "Extract JSON field",
     "description": "Extract a field from a JSON string.",
     "category": TransformCategory.STRING,
     "params": [_p("path", "JSON path", required=True)]},

    {"key": "json_stringify", "label": "To JSON string",
     "description": "Serialize the value to JSON.",
     "category": TransformCategory.STRING},

    {"key": "json_parse", "label": "From JSON string",
     "description": "Parse a JSON string to an object.",
     "category": TransformCategory.STRING},

    {"key": "json_array_join", "label": "Join JSON array",
     "description": "Join a JSON array into a string.",
     "category": TransformCategory.STRING,
     "params": [_p("separator", "Separator", default=",")]},

    {"key": "json_keys", "label": "Extract JSON keys",
     "description": "Return the top-level keys of a JSON object.",
     "category": TransformCategory.STRING},

    # ── BOOLEAN (4) ────────────────────────────────────────────
    {"key": "boolean_and", "label": "Boolean AND",
     "description": "Logical AND across multiple columns.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 2, "arity_max": 10},

    {"key": "boolean_or", "label": "Boolean OR",
     "description": "Logical OR across multiple columns.",
     "category": TransformCategory.CONDITIONAL, "arity_min": 2, "arity_max": 10},

    {"key": "boolean_not", "label": "Boolean NOT",
     "description": "Invert the boolean value.",
     "category": TransformCategory.CONDITIONAL},

    {"key": "boolean_parse", "label": "Parse boolean",
     "description": "Parse 'yes', '1', 'true' as boolean.",
     "category": TransformCategory.CONDITIONAL},
]


def build_seed_transformations() -> list[Transformation]:
    """Convert the declarative list into Transformation models."""
    out: list[Transformation] = []
    for spec in BUILTIN_TRANSFORMS:
        out.append(Transformation(
            tenant_id="tenant-default",
            key=spec["key"],
            label=spec["label"],
            description=spec.get("description", ""),
            category=spec["category"],
            kind=TransformKind.BUILTIN,
            arity_min=spec.get("arity_min", 1),
            arity_max=spec.get("arity_max", 1),
            params=spec.get("params", []),
            example=spec.get("example"),
            is_system=True,
        ))
    return out