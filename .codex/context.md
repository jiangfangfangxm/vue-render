# Project Context

This project is an Agent-driven UI system.

Key concepts:

- UI Schema → JSON describing UI
- Renderer → Vue3 components
- WorkflowEnvelope → UI + state
- WorkflowEvent → user action
- PatchEngine → partial updates

Important rules:

- Never mutate schema directly
- Always use patch operations
- UI must be stateless
