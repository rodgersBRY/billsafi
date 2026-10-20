export type Errors = Record<string, string>;

export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  return Object.fromEntries(issues.map((issue) => [issue.path.join("."), issue.message]));
}
