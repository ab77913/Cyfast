# Prompt Examples

This folder stores few-shot YAML examples used to guide AI generation tasks.

## Scope

These examples are currently intended for:

- Requirement generation
- Test scenario generation
- Test case generation

Test script examples are intentionally not included because test script generation is not implemented yet.

## Runtime status

These YAML files are **not connected to runtime logic** today. They serve as a curated example library only.

Later, an example loader or LangGraph agent can select examples based on document type and generation task (for example, BRD requirement examples for BRD documents, or functional scenario examples for functional scenario generation).

## Folder layout

| Folder | Purpose |
|--------|---------|
| `requirements/` | Few-shot examples by document type (BRD, FRD, SRS, HLR, LLR) |
| `test_scenarios/` | Few-shot examples by scenario style (functional, workflow, negative/boundary/validation) |
| `test_cases/` | Few-shot examples by test case style (manual, API, data validation) |

## Domain

All examples use the Hospital Management System sample domain and cover only these modules:

- Dashboard
- Staff Management
- Patient Registration
- Visit Management
- Prescription Management
- Patient History
