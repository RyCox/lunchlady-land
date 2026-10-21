import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listFoodItems } from "@/lib/catalog";
import { CATEGORIES, CREDITABLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const show = (n: number) => (n ? String(n) : "");

export default async function CatalogPage() {
  const user = await requireUser();
  const items = await listFoodItems();
  const admin = user.role === "admin";
  return (
    <>
      <h1>Food items</h1>
      <p className="muted">
        The district catalog. Production Records copy these details when a record is started.
        {admin ? " Edits apply to records started afterwards; filed records keep their copy." : " Only district admins can change it."}
      </p>
      {admin && <div className="actions"><Link className="btn" href="/admin/items/new">Add food item</Link></div>}
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Item #</th><th>Description</th><th>HACCP</th><th>Portion</th><th>Unit</th>
              {CREDITABLE.map(([, l]) => <th key={l}>{l}</th>)}<th>Source</th><th>Active</th>{admin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(([cat, label]) => [
              <tr key={cat} className="group"><td colSpan={admin ? 18 : 17}>{label}</td></tr>,
              ...items.filter((i) => i.category === cat).map((i) => (
                <tr key={i.id} style={i.active ? undefined : { opacity: 0.55 }}>
                  <td>{i.item_no}</td><td className="wrap">{i.description}</td><td>{i.haccp}</td>
                  <td>{i.portion_size}</td><td>{i.unit}</td>
                  {CREDITABLE.map(([k]) => <td key={k}>{show(i[k])}</td>)}
                  <td>{i.source}</td><td>{i.active ? "Yes" : "No"}</td>
                  {admin && <td><Link href={`/admin/items/${i.id}`}>Edit</Link></td>}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}
