import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getMenu, listFoodItems } from "@/lib/catalog";
import { CATEGORIES, PLANNED } from "@/lib/constants";
import { plannedTotal } from "@/lib/validate";
import { Notice, type Search } from "@/components/Notice";
import { addMenuItemAction, saveMenuAction, saveMenuItemsAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditMenuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  await requireAdmin();
  const { id } = await params;
  const data = id === "new" ? null : await getMenu(Number(id));
  if (id !== "new" && !data) notFound();
  const foodItems = data ? await listFoodItems({ activeOnly: true }) : [];
  const menu = data?.menu;

  return (
    <>
      <p className="muted" style={{ margin: 0 }}><Link href="/admin/menus">← Menus</Link></p>
      <h1>{menu ? `Menu #${menu.menu_no} ${menu.name}` : "New menu"}</h1>
      <Notice searchParams={searchParams} />
      <form action={saveMenuAction} className="card row">
        {menu && <input type="hidden" name="id" value={menu.id} />}
        <label className="field">Menu #<input type="number" name="menu_no" defaultValue={menu?.menu_no} required /></label>
        <label className="field" style={{ minWidth: 240 }}>Name<input name="name" defaultValue={menu?.name} required /></label>
        <label className="field">Meal
          <select name="meal" defaultValue={menu?.meal ?? "lunch"}>
            <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
          </select>
        </label>
        <label className="field check"><input type="checkbox" name="active" defaultChecked={menu?.active ?? true} /> Active</label>
        <button type="submit">Save menu</button>
      </form>

      {data && (
        <>
          <h2>Items and planned servings</h2>
          <form action={saveMenuItemsAction}>
            <input type="hidden" name="menuId" value={data.menu.id} />
            <button type="submit" name="intent" value="save" tabIndex={-1} aria-hidden="true"
              style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Item #</th><th>Description</th>{PLANNED.map(([, l]) => <th key={l}>{l}</th>)}<th className="num">Total</th><th></th></tr>
                </thead>
                <tbody>
                  {CATEGORIES.map(([cat, label]) => [
                    <tr key={cat} className="group"><td colSpan={9}>{label}</td></tr>,
                    ...data.items.filter((i) => i.category === cat).map((i) => (
                      <tr key={i.id}>
                        <td>{i.item_no}<input type="hidden" name="itemId" value={i.id} /></td>
                        <td className="wrap">{i.description}</td>
                        {PLANNED.map(([k]) => (
                          <td key={k}><input className="xs" type="number" min={0} name={`i${i.id}.${k}`} defaultValue={i[k] || ""} aria-label={`${i.description} ${k}`} /></td>
                        ))}
                        <td className="num derived">{plannedTotal(i)}</td>
                        <td><button className="link" type="submit" name="intent" value={`remove:${i.id}`}>Remove</button></td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
            <div className="actions"><button type="submit" name="intent" value="save">Save planned servings</button></div>
          </form>
          <form action={addMenuItemAction} className="card row">
            <input type="hidden" name="menuId" value={data.menu.id} />
            <label className="field" style={{ minWidth: 320 }}>Add a food item
              <select name="foodItemId">
                {CATEGORIES.map(([cat, label]) => (
                  <optgroup key={cat} label={label}>
                    {foodItems.filter((f) => f.category === cat && !data.items.some((i) => i.food_item_id === f.id)).map((f) => (
                      <option key={f.id} value={f.id}>{f.item_no} {f.description}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="submit" className="secondary">Add item</button>
          </form>
        </>
      )}
    </>
  );
}
