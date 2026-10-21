export function StatusPill({ status, version }: { status: "draft" | "finalized"; version: number }) {
  if (status === "draft") return <span className="pill draft">Draft</span>;
  return <span className="pill finalized">Finalized{version > 1 ? ` · v${version} amended` : ""}</span>;
}
