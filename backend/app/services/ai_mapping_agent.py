import json
from typing import Dict, Any, List, Optional, Literal, TypedDict
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END

from app.core.groq_manager import groq_manager


# ==========================================
# 1. Pydantic Structured Output Schemas
# ==========================================

class AttributeMatch(BaseModel):
    target_column: str = Field(
        ...,
        description="The exact target attribute / column name from the Target Schema (File 2) that needs to be populated.",
    )
    matched_source_column: Optional[str] = Field(
        None,
        description="The exact matching source attribute / column name from the Source Schema (File 1). MUST be selected VERBATIM from the available source columns list. Must be None if no valid match exists.",
    )
    confidence_pct: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Confidence level percentage of this match strictly between 0.0 and 100.0 based on semantic meaning, data types, sample values, and metadata.",
    )
    match_type: Literal["EXACT", "SEMANTIC", "METADATA_DERIVED", "UNMATCHED"] = Field(
        ...,
        description="Classification of the match: EXACT (identical name), SEMANTIC (synonyms/domain equivalent), METADATA_DERIVED (audit/governance/system tags), or UNMATCHED (no reliable source attribute exists).",
    )
    reasoning: str = Field(
        ...,
        description="Clear, factual, non-hallucinated explanation for why this source column was chosen (or why it remained unmatched), citing column name similarity, data types, sample values, or metadata context.",
    )
    suggested_default_value: Optional[str] = Field(
        None,
        description="Suggested default fallback value for the target column if it is unmatched or requires a standard constant.",
    )


class SchemaMappingResult(BaseModel):
    matches: List[AttributeMatch] = Field(
        ...,
        description="Comprehensive list of attribute mapping decisions for every column in the target schema.",
    )
    overall_confidence: float = Field(
        ...,
        description="Average confidence score across all mapped attributes (0.0 to 100.0).",
    )
    reasoning_summary: str = Field(
        ...,
        description="Executive summary of the AI schema analysis and mapping strategy.",
    )


# ==========================================
# 2. Anti-Hallucination System Prompt
# ==========================================

ANTI_HALLUCINATION_SYSTEM_PROMPT = """You are an Enterprise Schema & Metadata Mapping Intelligence Engine.
Your sole mission is to accurately map columns from a Source Dataset (File 1) to a Target Template Schema (File 2).

### STRICT GROUND RULES & ANTI-HALLUCINATION PROTOCOL:
1. STRICT VERBATIM SOURCE SELECTION:
   You are strictly forbidden from inventing, hallucinating, abbreviating, or assuming non-existent source column names.
   You must select `matched_source_column` ONLY from the exact list of available source columns provided in the prompt.
   If a source column does not exist verbatim in the source schema, DO NOT USE IT.

2. PRESERVE METADATA ATTRIBUTES:
   Pay close attention to metadata attributes (such as `meta_source_system`, `meta_data_classification`, `meta_record_hash`, `meta_last_audited`, `meta_sync_status`, `Audit Checksum`, `Governance Level`).
   Map metadata attributes in File 1 to their corresponding target metadata fields in File 2 whenever semantics match.

3. ADHERE TO USER SPECIAL INSTRUCTIONS:
   If the user has provided special instructions or mapping rules, prioritize their specific intent (e.g. override defaults, map specific fields, treat status flags appropriately).

4. CONSERVATIVE UNMATCHED ASSIGNMENT:
   If a target column has no reasonably matching counterpart in the source schema (e.g. target asks for 'Status' and source has no status field), you MUST set `matched_source_column` to null (`None`), set `match_type` to `UNMATCHED`, assign confidence below 40%, and provide a recommended `suggested_default_value` (e.g., 'Active', 'USD', 'N/A').

5. CALIBRATED CONFIDENCE SCORES:
   - 95% - 100%: Exact or standard domain synonym with matching data types & sample formats.
   - 75% - 94%: Strong semantic match or metadata alignment.
   - 50% - 74%: Plausible partial match.
   - Below 50%: Weak / Unmatched.

6. FACTUAL REASONING:
   Every single match must contain a concise, factual explanation referencing the attribute names, data types, sample values, or metadata context.
"""

# Fallback models in priority order
FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "groq/compound",
]


# ==========================================
# 3. LangGraph State & Workflow Execution
# ==========================================

class AgentState(TypedDict):
    source_schema: Dict[str, Any]
    target_schema: Dict[str, Any]
    available_source_cols: List[str]
    available_target_cols: List[str]
    custom_instructions: Optional[str]
    api_keys: Optional[List[str]]
    model_name: str
    result: Optional[SchemaMappingResult]
    error: Optional[str]


def create_mapping_graph():
    """Build and compile the LangGraph StateGraph workflow."""

    def prepare_context_node(state: AgentState) -> Dict[str, Any]:
        s_schema = state["source_schema"]
        t_schema = state["target_schema"]
        s_cols = [c["name"] for c in s_schema.get("columns", [])]
        t_cols = [c["name"] for c in t_schema.get("columns", [])]
        return {
            "available_source_cols": s_cols,
            "available_target_cols": t_cols,
        }

    def llm_matcher_node(state: AgentState) -> Dict[str, Any]:
        s_schema = state["source_schema"]
        t_schema = state["target_schema"]
        s_cols = state["available_source_cols"]
        t_cols = state["available_target_cols"]
        custom_instructions = state.get("custom_instructions")
        api_keys = state.get("api_keys")
        requested_model = state.get("model_name", "openai/gpt-oss-120b")

        # Prepare model candidate list starting with requested model
        models_to_try = [requested_model] + [m for m in FALLBACK_MODELS if m != requested_model]

        # Format source column descriptions
        source_desc_lines = []
        for col in s_schema.get("columns", []):
            samples_str = ", ".join(str(s) for s in col.get("sample_values", [])[:3])
            meta_tag = "[METADATA]" if col.get("is_metadata") else "[DATA]"
            source_desc_lines.append(
                f"- {col['name']} ({col.get('data_type', 'string')}) {meta_tag}: samples [{samples_str}]"
            )

        target_desc_lines = []
        for col in t_schema.get("columns", []):
            samples_str = ", ".join(str(s) for s in col.get("sample_values", [])[:2])
            meta_tag = "[METADATA]" if col.get("is_metadata") else "[DATA]"
            target_desc_lines.append(
                f"- {col['name']} ({col.get('data_type', 'string')}) {meta_tag}: samples [{samples_str}]"
            )

        custom_prompt_block = ""
        if custom_instructions and custom_instructions.strip():
            custom_prompt_block = f"""
### USER SPECIAL INSTRUCTIONS & CUSTOM MAPPING RULES:
{custom_instructions.strip()}
Please prioritize the above user instructions when mapping columns and determining default values.
"""

        human_prompt = f"""### SOURCE SCHEMA (File 1 - Available Source Columns):
{chr(10).join(source_desc_lines)}

### TARGET SCHEMA (File 2 - Required Target Columns):
{chr(10).join(target_desc_lines)}
{custom_prompt_block}
### CRITICAL INSTRUCTION:
Map every single Target column from File 2 to the best matching Source column from File 1.
You MUST choose `matched_source_column` ONLY from this exact list:
{json.dumps(s_cols)}

If a target column has no suitable source match, set `matched_source_column` to null.
Produce the final result adhering strictly to the structured Pydantic schema.
"""

        last_exception = None

        # Try models in fallback order
        for model in models_to_try:
            max_attempts = max(1, len(api_keys) if api_keys else groq_manager.get_keys_count())

            for attempt in range(max_attempts):
                try:
                    llm = groq_manager.get_chat_model(
                        model_name=model,
                        temperature=0.0,
                        provided_keys=api_keys,
                    )

                    structured_llm = llm.with_structured_output(SchemaMappingResult)

                    messages = [
                        SystemMessage(content=ANTI_HALLUCINATION_SYSTEM_PROMPT),
                        HumanMessage(content=human_prompt),
                    ]

                    result: SchemaMappingResult = structured_llm.invoke(messages)
                    if result and len(result.matches) > 0:
                        return {"result": result, "error": None}

                except Exception as e:
                    last_exception = e
                    continue

        return {
            "result": None,
            "error": f"AI Mapping Agent encountered an error: {str(last_exception)}",
        }

    # Build StateGraph
    builder = StateGraph(AgentState)
    builder.add_node("prepare_context", prepare_context_node)
    builder.add_node("llm_matcher", llm_matcher_node)

    builder.set_entry_point("prepare_context")
    builder.add_edge("prepare_context", "llm_matcher")
    builder.add_edge("llm_matcher", END)

    return builder.compile()


# Global workflow instance
mapping_graph = create_mapping_graph()


def run_ai_schema_mapping(
    source_schema: Dict[str, Any],
    target_schema: Dict[str, Any],
    custom_instructions: Optional[str] = None,
    api_keys: Optional[List[str]] = None,
    model_name: str = "openai/gpt-oss-120b",
) -> SchemaMappingResult:
    """Execute the LangGraph AI schema mapping workflow."""
    initial_state: AgentState = {
        "source_schema": source_schema,
        "target_schema": target_schema,
        "available_source_cols": [],
        "available_target_cols": [],
        "custom_instructions": custom_instructions,
        "api_keys": api_keys,
        "model_name": model_name or "openai/gpt-oss-120b",
        "result": None,
        "error": None,
    }

    final_state = mapping_graph.invoke(initial_state)

    if final_state.get("error"):
        raise RuntimeError(final_state["error"])

    return final_state["result"]
