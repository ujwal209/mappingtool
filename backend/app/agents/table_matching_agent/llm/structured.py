"""
Structured-output LLM runner for the table matching agent.

Uses LangChain's ChatGroq.with_structured_output() to enforce the
Pydantic TableMatchingResponse schema. Round-robins through the
Groq key pool with retry-on-failure.

Model is locked to openai/gpt-oss-120b for reproducibility.
"""

from typing import List, Optional, Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.core.groq_manager import groq_manager
from app.core.logging import get_logger

logger = get_logger("table_matching_llm")

T = TypeVar("T", bound=BaseModel)

DEFAULT_TABLE_MATCHING_MODEL = "openai/gpt-oss-120b"


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
    Invoke Groq with structured output against the given Pydantic schema.

    Returns:
        A validated instance of `schema`, or None if every attempt failed.
    """
    if model_name and model_name != DEFAULT_TABLE_MATCHING_MODEL:
        logger.info(
            f"[TableMatchingLLM] Ignoring model override "
            f"'{model_name}' — locked to '{DEFAULT_TABLE_MATCHING_MODEL}'"
        )
    resolved_model = DEFAULT_TABLE_MATCHING_MODEL

    attempts = max_retries or max(groq_manager.get_keys_count(), 3)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    last_error: Optional[Exception] = None

    for attempt in range(attempts):
        used_key: Optional[str] = None
        try:
            chat, used_key = groq_manager.get_chat_model(
                model_name=resolved_model,
                temperature=temperature,
                provided_keys=api_keys,
            )
            structured = chat.with_structured_output(schema)
            result = structured.invoke(messages)

            if isinstance(result, schema):
                groq_manager.record_success(used_key)
                logger.info(
                    f"[TableMatchingLLM] OK on attempt {attempt + 1}/"
                    f"{attempts} (schema={schema.__name__})"
                )
                return result

            # Coerce dict -> Pydantic.
            validated = schema.model_validate(result)
            groq_manager.record_success(used_key)
            logger.info(
                f"[TableMatchingLLM] OK (coerced dict) on attempt "
                f"{attempt + 1}/{attempts}"
            )
            return validated

        except Exception as err:  # noqa: BLE001
            last_error = err
            logger.warning(
                f"[TableMatchingLLM] Attempt {attempt + 1}/{attempts} "
                f"failed: {err}"
            )
            if used_key:
                groq_manager.record_failure(used_key, str(err))

    logger.error(
        f"[TableMatchingLLM] All {attempts} attempts failed. "
        f"Last error: {last_error}"
    )
    return None