/** Field errors keyed by the first path segment, from zod issues or the API's 400 issues. */
export function issuesByField(
  issues: readonly { path: string | readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field =
      typeof issue.path === "string" ? issue.path.split(".")[0] : String(issue.path[0] ?? "");
    if (field && field !== "reason" && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
