---
name: Gemini model availability
description: Provider model availability can differ from the requested model name for newly provisioned keys.
---

When a requested Gemini model is rejected as unavailable to new users, preserve the requested model as the first attempt and use the provider's explicit current-model recommendation as a narrowly scoped fallback.

**Why:** A live smoke test showed that the requested model name can be retired for new API keys even when the integration itself is configured correctly.

**How to apply:** Only fall back on the provider's explicit retirement/unavailability message; surface other provider errors instead of silently changing models.