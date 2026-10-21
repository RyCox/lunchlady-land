export type Search = Promise<Record<string, string | string[] | undefined>>;

/** Shows the ?msg= or ?error= that server actions redirect back with. */
export async function Notice({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const msg = typeof sp.msg === "string" ? sp.msg : null;
  if (error) return <div className="notice error" role="alert">{error}</div>;
  if (msg) return <div className="notice ok" role="status">{msg}</div>;
  return null;
}
