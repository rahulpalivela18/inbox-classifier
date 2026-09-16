---
name: Generated client DOM iterable
description: The generated React client serializes Headers with Headers.entries().
---

Generated API client builds require `dom.iterable` in the client library TypeScript
lib list because the generated request helper uses `Headers.entries()`.

**Why:** The default shared TypeScript libs do not expose iterable DOM collection
methods, so OpenAPI codegen can succeed while the workspace typecheck fails.

**How to apply:** Keep `dom.iterable` enabled for any generated browser client
library and rerun the full workspace typecheck after codegen.