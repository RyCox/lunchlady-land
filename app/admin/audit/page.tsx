import { requireAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  production_records: "Production Record", production_record_lines: "Record line", pull_sheet_lines: "Pull Sheet line",
  food_items: "Food item", menus: "Menu", menu_items: "Menu item", amendments: "Amendment", schools: "School", users: "User",
};

const SKIP = new Set(["id", "record_id", "record_line_id", "food_item_id", "menu_id", "created_at"]);

function summarize(oldV: unknown, newV: unknown) {
  const o = (oldV ?? {}) as Record<string, unknown>;
  const n = (newV ?? {}) as Record<string, unknown>;
  const label = n.description ?? o.description ?? n.name ?? o.name ?? n.item_no ?? "";
  if (!oldV) return `Created ${label}`;
  if (!newV) return `Deleted ${label}`;
  const changed = Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]));
  return `${label ? `${label}: ` : ""}${changed.map((k) => `${k} ${JSON.stringify(o[k])} → ${JSON.stringify(n[k])}`).join(", ")}`;
}

export default async function AuditPage() {
  const user = await requireAdmin();
  const events = await listAudit(user, { limit: 300 });
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Every insert, update and delete, written by the database. Latest 300 shown. This log cannot be edited.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Change</th><th>Reason</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{e.at.slice(0, 19)}</td><td>{e.user_name ?? "system"}</td>
                <td>{TABLES[e.table_name] ?? e.table_name} #{e.row_id}</td>
                <td className="wrap" style={{ fontSize: 13 }}>{summarize(e.old_value, e.new_value)}</td>
                <td className="wrap">{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
