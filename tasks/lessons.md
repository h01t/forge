# Lessons Learned

- Persist enum-like values in canonical storage form instead of JSON-stringifying them into text columns.
- Treat provider metadata as a product-truth source so planned integrations are explicit in both the UI and runtime gating.
- Avoid remote font dependencies in the desktop shell; local/system stacks keep Next.js builds reliable in restricted environments.
