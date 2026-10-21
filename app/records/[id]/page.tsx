import Link from "next/link";
import { listFoodItems } from "@/lib/catalog";
import { listAmendments, listArchives } from "@/lib/records";
import { renderProductionRecordHtml } from "@/lib/print";
import { validateRecord } from "@/lib/validate";
import { Notice, type Search } from "@/components/Notice";
import { RecordForm } from "@/components/RecordForm";
import { StatusPill } from "@/components/StatusPill";
import { loadRecordPage } from "./load";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  prepared_by: "Prepared by", offer_vs_serve: "Offer vs. Serve", ovs_reason: "OvS reason", count_notes: "Count notes",
  count_pk: "PK count", count_k5: "K-5 count", count_k8: "K-8 count", count_912: "9-12 count",
  count_adults: "Adult count", count_staff: "Cafe staff count", num_sold_alc: "Sold ALC/adult",
  planned_pk: "Planned PK", planned_k5: "Planned K-5", planned_k8: "Planned K-8", planned_912: "Planned 9-12", planned_other: "Planned other",
  "pull_sheet.prepared_by_initials": "Initials", "pull_sheet.qty_pulled": "Cases/cans pulled", "pull_sheet.temp1": "Temp #1",
  "pull_sheet.temp2": "Temp #2", "pull_sheet.amount_prepared": "Amount prepared", "pull_sheet.amount_used": "Amount used",
  "pull_sheet.amount_leftover": "Amount leftover", "pull_sheet.leftover_code": "Leftover code",
};

export default async function RecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { user, data } = await loadRecordPage(params);
  const { record } = data;
  const title = `${record.school_name} · ${record.meal === "lunch" ? "Lunch" : "Breakfast"} · ${record.record_date}`;

  const header = (
    <>
      <p className="muted" style={{ margin: 0 }}><Link href="/">← All records</Link></p>
      <h1>{title} <StatusPill status={record.status} version={record.version} /></h1>
      <p className="muted" style={{ marginTop: 0 }}>Menu #{record.menu_no} {record.menu_name}</p>
      <Notice searchParams={searchParams} />
      <div className="actions">
        <Link className="btn secondary" href={`/records/${record.id}/print/pull-sheet`}>Print Pull Sheet</Link>
        <Link className="btn secondary" href={`/records/${record.id}/print/production`}>
          Print Production Record{record.status === "draft" ? " (draft)" : ""}
        </Link>
        {record.status === "finalized" && <Link className="btn" href={`/records/${record.id}/amend`}>Amend</Link>}
      </div>
    </>
  );

  if (record.status === "draft") {
    const foodItems = await listFoodItems({ activeOnly: true });
    return (
      <>
        {header}
        <RecordForm data={data} mode="draft" foodItems={foodItems} validation={validateRecord(record, data.lines)} />
      </>
    );
  }

  const [amendments, archives] = await Promise.all([listAmendments(user, record.id), listArchives(user, record.id)]);
  return (
    <>
      {header}
      <div className="notice ok">
        Finalized by {record.finalized_by_name} on {record.finalized_at?.slice(0, 16)} UTC. This record is locked; changes need an amendment with a reason.
      </div>
      <div className="table-wrap print-page" dangerouslySetInnerHTML={{ __html: renderProductionRecordHtml(data) }} />

      <h2>Amendments</h2>
      {amendments.length === 0 ? <p className="muted">None.</p> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Version</th><th>When</th><th>Who</th><th>Reason</th><th>Changes</th></tr></thead>
            <tbody>
              {amendments.map((a) => (
                <tr key={a.id}>
                  <td>v{a.version}</td><td>{a.amended_at.slice(0, 16)}</td><td>{a.amended_by_name}</td>
                  <td className="wrap">{a.reason}</td>
                  <td className="wrap">
                    <pre className="diff">{a.changes.map((c) =>
                      `${c.line ? `${c.line}: ` : ""}${FIELD_LABELS[c.field] ?? c.field} ${String(c.from ?? "—")} → ${String(c.to ?? "—")}`).join("\n")}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Archived copies</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Version</th><th>Archived</th><th>By</th><th>SHA-256</th><th></th></tr></thead>
          <tbody>
            {archives.map((a) => (
              <tr key={a.version}>
                <td>v{a.version}</td><td>{a.created_at.slice(0, 16)}</td><td>{a.created_by_name}</td>
                <td><code style={{ fontSize: 12 }}>{a.sha256.slice(0, 16)}…</code></td>
                <td><Link href={`/records/${record.id}/archive/${a.version}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
