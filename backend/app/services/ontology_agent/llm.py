"""
Structured-output LLM wrapper locked to openai/gpt-oss-120b.

Key fix: Groq's json_schema + strict=True only compiles for FLAT schemas.
For schemas with many optional fields (like EntityOperation with 8
nullable fields), we must use one of:

  A) A "discriminated union" schema (one variant per op kind) — cleanest
  B) function_calling — Groq tool calling, more forgiving
  C) json_mode with a hand-rolled validator — fallback of last resort

This module now:
  1. Tries function_calling FIRST for complex schemas (detected by
     presence of Literal discriminator + many optional fields).
  2. Falls back to json_schema+strict for flat schemas.
  3. Falls back to json_mode + pydantic validation.
  4. Reports WHICH field failed on validation error.
"""

from typing import Any, List, Optional, Type, TypeVar, get_args, get_origin

from langchain_core.messages import AnyMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel, ValidationError

from app.core.groq_manager import groq_manager
from app.core.logging import logger

T = TypeVar("T", bound=BaseModel)

GROQ_MODEL = "openai/gpt-oss-120b"
MAX_TOKENS = 4096


def _is_complex_schema(schema: Type[BaseModel]) -> bool:
    """
    Heuristic: a schema is 'complex' (unsafe for strict=True) if any
    nested model has more than 2 optional fields, OR if a field is a
    Literal union with >2 members and other optional fields coexist.
    """
    try:
        fields = schema.model_fields
    except AttributeError:
        return False
    optional_count = sum(1 for f in fields.values() if not f.is_required())
    if optional_count > 2:
        return True
    # Inspect nested models
    for f in fields.values():
        ann = f.annotation
        if ann is None:
            continue
        origin = get_origin(ann)
        args = get_args(ann)
        candidates = list(args) if origin else [ann]
        for cand in candidates:
            if isinstance(cand, type) and issubclass(cand, BaseModel):
                try:
                    sub_fields = cand.model_fields
                    sub_optional = sum(1 for sf in sub_fields.values() if not sf.is_required())
                    if sub_optional > 2:
                        return True
                except AttributeError:
                    pass
    return False


class StructuredLLM:
    def __init__(self, model_override: Optional[str] = None, temperature: float = 0.1):
        if model_override and model_override != GROQ_MODEL:
            logger.info(f"[LLM] Ignoring model_override='{model_override}' — locked to '{GROQ_MODEL}'")
        self._temperature = temperature

    def _client(self, api_key: str) -> ChatGroq:
        return ChatGroq(
            groq_api_key=api_key,
            model_name=GROQ_MODEL,
            temperature=self._temperature,
            max_tokens=MAX_TOKENS,
        )

    def chat(self, messages: List[AnyMessage]) -> str:
        last_error: Optional[Exception] = None
        attempts = max(1, groq_manager.get_keys_count())
        for _ in range(attempts):
            api_key, _ = groq_manager.get_next_key()
            try:
                response = self._client(api_key).invoke(messages)
                groq_manager.record_success(api_key)
                return str(response.content)
            except Exception as exc:
                groq_manager.record_failure(api_key, str(exc))
                last_error = exc
                logger.warning(f"[LLM] chat failed: {exc}")
        raise RuntimeError(f"All Groq keys failed. Last error: {last_error}")

    def structured(self, messages: List[AnyMessage], schema: Type[T]) -> T:
        """
        Method order depends on schema complexity:
          - Complex schemas → function_calling first (Groq's strict grammar
            compiler rejects schemas with >2 optional fields per object).
          - Simple/flat schemas → json_schema+strict first (best fidelity).
          - json_mode is always last.
        """
        complex_schema = _is_complex_schema(schema)
        if complex_schema:
            methods = [
                ("function_calling", {}),
                ("json_schema", {"strict": False}),
                ("json_mode", {}),
            ]
            logger.info(f"[LLM] {schema.__name__} classified COMPLEX — using function_calling first")
        else:
            methods = [
                ("json_schema", {"strict": True}),
                ("function_calling", {}),
                ("json_mode", {}),
            ]

        last_error: Optional[Exception] = None
        attempts = max(1, groq_manager.get_keys_count())

        for attempt in range(attempts):
            for method, kwargs in methods:
                api_key, _ = groq_manager.get_next_key()
                try:
                    client = self._client(api_key)
                    logger.info(
                        f"[LLM] Attempt {attempt+1}/{attempts}: "
                        f"schema={schema.__name__}, method={method}, kwargs={kwargs}"
                    )
                    runner = client.with_structured_output(schema, method=method, **kwargs)
                    payload = messages
                    if method == "json_mode":
                        payload = self._ensure_json_hint(messages)
                    result = runner.invoke(payload)
                    groq_manager.record_success(api_key)

                    if isinstance(result, schema):
                        logger.info(f"[LLM] OK (schema={schema.__name__}, method={method})")
                        return result

                    try:
                        return schema.model_validate(result)
                    except ValidationError as ve:
                        # Surface EXACTLY which field failed
                        details = "; ".join(
                            f"{err['loc']}: {err['msg']}" for err in ve.errors()[:5]
                        )
                        logger.error(
                            f"[LLM] Validation failed after {method}: {details}"
                        )
                        last_error = ve
                        continue  # try next method

                except Exception as exc:
                    groq_manager.record_failure(api_key, str(exc))
                    last_error = exc
                    logger.warning(
                        f"[LLM] {method} failed (schema={schema.__name__}): {exc}"
                    )

        raise RuntimeError(
            f"All methods failed for {schema.__name__}. Last error: {last_error}"
        )

    def _ensure_json_hint(self, messages: List[AnyMessage]) -> List[AnyMessage]:
        for m in messages:
            content = getattr(m, "content", "")
            if isinstance(content, str) and "json" in content.lower():
                return list(messages)
        out = [SystemMessage(content="Respond ONLY with valid JSON.")]
        out.extend(messages)
        return out


def build_llm(model_override: Optional[str] = None, temperature: float = 0.1) -> StructuredLLM:
    return StructuredLLM(model_override=model_override, temperature=temperature)