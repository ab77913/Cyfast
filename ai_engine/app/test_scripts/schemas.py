"""Request and response schemas for test script generation."""

from typing import Optional

from pydantic import BaseModel, Field, model_validator


class GenerateRequest(BaseModel):
    """Request body for test script generation."""

    project_description: str = Field(
        ...,
        description="Description of the project under test",
    )
    requirements: str = Field(
        ...,
        description="Functional or test requirements",
    )
    test_scenario: str = Field(
        ...,
        description="The test scenario to automate",
    )
    framework: str = Field(
        ...,
        description="Target framework: selenium_pytest, playwright_pytest, or robot_framework",
    )
    test_dir_path: Optional[str] = Field(
        default=None,
        description="Optional path to existing test automation directory for structure analysis",
    )
    example_script: Optional[str] = Field(
        default=None,
        description="Optional raw example script string",
    )
    example_script_path: Optional[str] = Field(
        default=None,
        description="Optional path to an example test script file",
    )


class GenerateResponse(BaseModel):
    """Response body for test script generation."""

    test_steps: list[str] = Field(
        default_factory=list,
        description="Planned test steps",
    )
    generated_script: str = Field(
        default="",
        description="Generated automation script",
    )
    status: str = Field(
        default="success",
        description="Status of the generation",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for iterative regeneration. Pass to /regenerate to maintain context.",
    )


class RegenerateRequest(BaseModel):
    """Regenerate/refine a script based on user feedback."""

    user_comments: str = Field(
        ...,
        description="User feedback: what is missing, what needs to change, or what is not up to the mark",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID from /generate. When provided, current_script is loaded from session.",
    )
    current_script: Optional[str] = Field(
        default=None,
        description="The script to improve. Required when session_id is not provided.",
    )
    framework: Optional[str] = Field(
        default=None,
        description="Framework used (selenium_pytest, playwright_pytest, robot_framework). Helps maintain consistency.",
    )
    project_description: Optional[str] = Field(
        default=None,
        description="Optional project context for better refinements",
    )
    requirements: Optional[str] = Field(
        default=None,
        description="Optional requirements context",
    )
    test_scenario: Optional[str] = Field(
        default=None,
        description="Optional test scenario context",
    )

    @model_validator(mode="after")
    def require_script_or_session(self):
        """Either session_id or current_script must be provided."""
        if self.session_id:
            return self
        if not self.current_script or not self.current_script.strip():
            raise ValueError("Either session_id or current_script must be provided")
        return self
