export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: ApiError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}
