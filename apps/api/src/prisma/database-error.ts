export function hasDatabaseCode(
  error: unknown,
  code: string,
  depth = 0,
): boolean {
  if (depth > 5 || typeof error !== 'object' || error === null) return false;
  const details = error as { code?: unknown; cause?: unknown };
  return (
    details.code === code || hasDatabaseCode(details.cause, code, depth + 1)
  );
}
