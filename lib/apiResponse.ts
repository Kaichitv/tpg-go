// lib/apiResponse.ts
// Traduction homogène des erreurs de la couche data en réponses HTTP.

import { NotFoundError, UpstreamError } from "./transport";

export function errorResponse(err: unknown): Response {
  if (err instanceof NotFoundError) {
    return Response.json({ error: "not_found", detail: err.message }, { status: 404 });
  }
  if (err instanceof UpstreamError) {
    return Response.json({ error: "upstream", detail: err.message }, { status: 502 });
  }
  return Response.json({ error: "internal", detail: String(err) }, { status: 500 });
}
