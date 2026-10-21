import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMenus, listSchools } from "@/lib/catalog";
import { listRecords } from "@/lib/records";
import { mealCountTotal } from "@/lib/validate";
import { Notice, type Search } from "@/components/Notice";
import { StatusPill } from "@/components/StatusPill";
import { createRecordAction } from "./actions";

export const dynamic = "force-dynamic";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function Home({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const sp = await searchParams;
  const schoolFilter = user.role === "admin" && sp.school ? Number(sp.school) : undefined;
  const [records, menus, schools] = await Promise.all([
    listRecords(user, { schoolId: schoolFilter }),
    listMenus({ activeOnly: true }),
    listSchools(),
  ]);

  return (
    <>
      <h1>{user.role === "admin" ? "Production Records, all schools" : `Production Records, ${user.school_name}`}</h1>
      <Notice searchParams={searchParams} />

      <ol className="steps">
        <li>Start the day&apos;s record from a district menu.</li>
        <li>Adjust items and planned servings to what you are actually serving.</li>
        <li>Print the Pull Sheet for the kitchen (and a draft Production Record if you like).</li>
        <li>After service, type the Pull Sheet counts and meal counts in.</li>
        <li>Finalize, print and file the Production Record.</li>
      </ol>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Start a record</h2>
        <form action={createRecordAction} className="row">
          {user.role === "admin" && (
            <label className="field">
              School
              <select name="schoolId" required>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            Date
            <input type="date" name="date" defaultValue={today()} required />
          </label>
          <label className="field">
            Meal
            <select name="meal" defaultValue="lunch">
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 240 }}>
            District menu
            <select name="menuId" required>
              {["breakfast", "lunch"].map((meal) => (
                <optgroup key={meal} label={meal === "lunch" ? "Lunch" : "Breakfast"}>
                  {menus.filter((m) => m.meal === meal).map((m) => (
                    <option key={m.id} value={m.id}>#{m.menu_no} {m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="submit">Start record</button>
        </form>
      </div>

      <h2>Records</h2>
      {user.role === "admin" && (
        <form className="row" style={{ marginBottom: 10 }}>
          <label className="field">
            School
            <select name="school" defaultValue={schoolFilter ?? ""}>
              <option value="">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button type="submit" className="secondary">Filter</button>
        </form>
      )}
      {records.length === 0 ? (
        <p className="muted">No records yet. Start one above.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th><th>Meal</th>{user.role === "admin" && <th>School</th>}<th>Menu</th>
                <th className="num">Meals served</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.record_date}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.meal}</td>
                  {user.role === "admin" && <td>{r.school_name}</td>}
                  <td>#{r.menu_no} {r.menu_name}</td>
                  <td className="num">{mealCountTotal(r) || "—"}</td>
                  <td><StatusPill status={r.status} version={r.version} /></td>
                  <td><Link href={`/records/${r.id}`}>{r.status === "draft" ? "Open" : "View"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
