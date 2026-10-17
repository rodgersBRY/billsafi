export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: FieldIssue[] = [],
    readonly code?: string,
  ) {
    super(message);
  }

  /** Field-level messages keyed by path, for form display. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.issues.map((issue) => [issue.path, issue.message]));
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[];
    issues?: FieldIssue[];
    code?: string;
  };
  const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
  throw new ApiError(response.status, message ?? "Something went wrong", body.issues, body.code);
}
