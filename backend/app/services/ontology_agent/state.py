from typing import Any, Dict, List, Optional, TypedDict

class AgentState(TypedDict, total=False):
    tenant_id: str
    project_id: str
    prompt: str
    mode: str
    model: Optional[str]
    chat_history: Optional[List[Dict[str, str]]]
    target_ontology_id: Optional[str]
    domain: Optional[str]
    ontology_name: Optional[str]

    # Router & Operations
    intent: Optional[str]
    operations: List[Dict[str, Any]]
    operation_summary: Optional[str]
    operation_results: List[Dict[str, Any]]

    # Working state
    existing_ontology_summary: Optional[str]
    existing_entity_names: Optional[List[str]]
    domain_analysis: Optional[Dict[str, Any]]
    entities: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    reasoning_steps: List[Dict[str, str]]

    # Outputs
    plan_data: Optional[Dict[str, Any]]
    final_ontology: Optional[Dict[str, Any]]
    response_markdown: Optional[str]
    chat_reply: Optional[str]