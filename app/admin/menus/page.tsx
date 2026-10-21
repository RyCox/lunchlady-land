import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listMenus } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function MenusPage() {
  await requireAdmin();
  const menus = await listMenus();
  return (
    <>
      <h1>Menus</h1>
      <p className="muted">Each menu lists its food items and planned servings. Managers start a day&apos;s Production Record from one.</p>
      <div className="actions"><Link className="btn" href="/admin/menus/new">Add menu</Link></div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Menu #</th><th>Name</th><th>Meal</th><th className="num">Items</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id}>
                <td>{m.menu_no}</td><td>{m.name}</td><td style={{ textTransform: "capitalize" }}>{m.meal}</td>
                <td className="num">{m.item_count}</td><td>{m.active ? "Yes" : "No"}</td>
                <td><Link href={`/admin/menus/${m.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
