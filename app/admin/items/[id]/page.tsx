import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getFoodItem } from "@/lib/catalog";
import { CATEGORIES, CREDITABLE, HACCP, UNITS } from "@/lib/constants";
import { Notice, type Search } from "@/components/Notice";
import { saveFoodItemAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  await requireAdmin();
  const { id } = await params;
  const item = id === "new" ? null : await getFoodItem(Number(id));
  if (id !== "new" && !item) notFound();
  return (
    <>
      <p className="muted" style={{ margin: 0 }}><Link href="/catalog">← Food items</Link></p>
      <h1>{item ? `${item.item_no} ${item.description}` : "New food item"}</h1>
      <Notice searchParams={searchParams} />
      <form action={saveFoodItemAction} className="card">
        {item && <input type="hidden" name="id" value={item.id} />}
        <div className="grid2">
          <label className="field">Item #<input name="item_no" defaultValue={item?.item_no} required /></label>
          <label className="field">Description<input name="description" defaultValue={item?.description} required /></label>
          <label className="field">Section on the Production Record
            <select name="category" defaultValue={item?.category ?? "general"}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">HACCP process
            <select name="haccp" defaultValue={item?.haccp ?? "1"}>
              {HACCP.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">Actual portion size<input name="portion_size" defaultValue={item?.portion_size} placeholder="e.g. 1/2 cup" /></label>
          <label className="field">Pulled by
            <select name="unit" defaultValue={item?.unit ?? "case"}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="field">Source (SOURC)<input name="source" defaultValue={item?.source} placeholder="CN label, PFS, recipe #" /></label>
          <label className="field check"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Active (can be added to menus and records)</label>
        </div>
        <h2>Creditable amount per serving</h2>
        <p className="muted">Oz eq for MMA and Grain; cups for vegetables, fruit and milk.</p>
        <div className="row">
          {CREDITABLE.map(([k, l]) => (
            <label key={k} className="field">{l}<input type="number" step="any" min={0} name={k} defaultValue={item?.[k] || ""} /></label>
          ))}
        </div>
        <div className="actions"><button type="submit">Save item</button></div>
      </form>
    </>
  );
}
