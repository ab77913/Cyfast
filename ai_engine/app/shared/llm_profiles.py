"""Named LLM stacks for routing model + provider overrides (see Settings *_{llm_provider,openai_model,ollama_model})."""

from enum import StrEnum


class LLMProfile(StrEnum):
    """Capability key must match Settings prefix ({value}_openai_model, etc.)."""

    REQUIREMENTS = "requirements"
    TEST_SCENARIOS = "test_scenarios"
    TEST_CASES = "test_cases"
    TEST_DATA = "test_data"
    TRACEABILITY = "traceability"
    VALIDATION = "validation"
    RAG_CHAT = "rag_chat"
    RAG_TREE = "rag_tree"
    TEST_SCRIPTS = "test_scripts"
