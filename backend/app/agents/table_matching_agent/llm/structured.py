"""
Structured-output LLM runner for the table matching agent.

Uses strict Pydantic parsing with full schema field definitions and format
instructions, avoiding brittle OpenAI tool-choice gates on Groq endpoints
that cause 400 'tool_use_failed' or token truncation errors.

Round-robins through the Groq key pool with retry-on-failure and multi-model fallback.
"""

import json
import re
from typing import Any, Dict, List, Optional, Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel

from app.core.groq_manager import groq_manager
from app.core.logging import get_logger

logger = get_logger("table_matching_llm")

T = TypeVar("T", bound=BaseModel)

DEFAULT_TABLE_MATCHING_MODEL = "openai/gpt-oss-120b"
FALLBACK_TABLE_MATCHING_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]


def _extract_and_validate_json(raw_text: str, schema: Type[T]) -> T:
    """
    Cleans raw LLM output and validates it against the Pydantic schema.
    Handles markdown code fences, leading/trailing prose, and trailing commas.
    """
    text = (raw_text or "").strip()

    # 1. Strip markdown fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    # 2. Extract substring between the first '{' and last '}'
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    # 3. Clean up trailing commas before closing braces/brackets
    cleaned_json = re.sub(r",\s*([}\]])", r"\1", text)

    # 4. Parse JSON
    data = json.loads(cleaned_json)

    # 5. Validate against Pydantic schema
    return schema.model_validate(data)


def run_structured_table_matching(
    schema: Type[T],
    system_prompt: str,
    user_prompt: str,
    api_keys: Optional[List[str]] = None,
    model_name: Optional[str] = None,
    temperature: float = 0.0,
    max_retries: Optional[int] = None,
) -> Optional[T]:
    """
    Invoke Groq with structured Pydantic schema output.
    Does not rely on brittle forced tool calling; instead provides explicit
    JSON schema definitions with max_tokens=8192 to prevent token truncation.

    Returns:
        A validated instance of `schema`, or None if every attempt failed.
    """
    primary_model = model_name or DEFAULT_TABLE_MATCHING_MODEL
    models_to_try = [primary_model] + [
        m for m in FALLBACK_TABLE_MATCHING_MODELS if m != primary_model
    ]

    parser = PydanticOutputParser(pydantic_object=schema)
    format_instructions = parser.get_format_instructions()

    full_system_prompt = (
        f"{system_prompt}\n\n"
        "### STRICT JSON OUTPUT FORMAT INSTRUCTIONS ###\n"
        "You MUST respond ONLY with a single, valid JSON object conforming strictly "
        "to the Pydantic schema below. Do NOT output any markdown code blocks, "
        "backticks, explanations, or conversational filler. Output raw JSON only.\n\n"
        f"{format_instructions}"
    )

    messages = [
        SystemMessage(content=full_system_prompt),
        HumanMessage(content=user_prompt),
    ]

    attempts_per_model = max_retries or max(groq_manager.get_keys_count(), 3)
    last_error: Optional[Exception] = None

    for active_model in models_to_try:
        logger.info(f"[TableMatchingLLM] Attempting matching with model '{active_model}'")
        for attempt in range(attempts_per_model):
            used_key: Optional[str] = None
            try:
                chat, used_key = groq_manager.get_chat_model(
                    model_name=active_model,
                    temperature=temperature,
                    max_tokens=8192,
                    provided_keys=api_keys,
                )

                # Invoke chat model directly
                response = chat.invoke(messages)
                content = response.content if hasattr(response, "content") else str(response)

                # Check if tool_calls were emitted by the model instead of text
                if not content and hasattr(response, "additional_kwargs"):
                    tool_calls = response.additional_kwargs.get("tool_calls", [])
                    if tool_calls and "function" in tool_calls[0]:
                        content = tool_calls[0]["function"].get("arguments", "")

                if not content:
                    raise ValueError("Model returned empty content")

                validated = _extract_and_validate_json(content, schema)
                groq_manager.record_success(used_key)
                logger.info(
                    f"[TableMatchingLLM] OK on attempt {attempt + 1}/{attempts_per_model} "
                    f"using model '{active_model}' (schema={schema.__name__})"
                )
                return validated

            except Exception as err:  # noqa: BLE001
                last_error = err
                logger.warning(
                    f"[TableMatchingLLM] Model '{active_model}' attempt {attempt + 1}/{attempts_per_model} "
                    f"failed: {err}"
                )
                if used_key:
                    groq_manager.record_failure(used_key, str(err))

    logger.error(
        f"[TableMatchingLLM] All attempts across models failed. Last error: {last_error}"
    )
    return None
