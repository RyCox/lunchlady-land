import { addLineAction, amendRecordAction, saveRecordAction } from "@/app/actions";
import { CATEGORIES, LEFTOVER_CODES, MEAL_COUNTS, PLANNED } from "@/lib/constants";
import type { FoodItem, RecordLine, RecordWithLines } from "@/lib/types";
import { mealCountTotal, plannedTotal, type ValidationResult } from "@/lib/validate";

const v = (n: number | null | undefined) => (n == null ? "" : String(n));

function Grouped({ lines, cols, row }: { lines: RecordLine[]; cols: number; row: (l: RecordLine) => React.ReactNode }) {
  return (
    <>
      {CATEGORIES.map(([cat, label]) => {
        const group = lines.filter((l) => l.category === cat);
        return [
          <tr key={cat} className="group"><td colSpan={cols}>{label}{group.length === 0 && " (none)"}</td></tr>,
          ...group.map(row),
        ];
      })}
    </>
  );
}

export function ValidationPanel({ result }: { result: ValidationResult }) {
  if (!result.errors.length && !result.warnings.length)
    return <div className="notice ok">All checks pass. This record is ready to finalize.</div>;
  return (
    <>
      {result.errors.length > 0 && (
        <div className="notice error">
          <b>Must fix before finalizing</b>
          <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="notice warn">
          <b>Please double-check</b>
          <ul>{result.warnings.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </>
  );
}

export function RecordForm({
  data, mode, foodItems, validation,
}: {
  data: RecordWithLines;
  mode: "draft" | "amend";
  foodItems: FoodItem[];
  validation: ValidationResult;
}) {
  const { record, lines } = data;
  const draft = mode === "draft";
  const formId = "record-form";

  return (
    <>
      <form id={formId} action={draft ? saveRecordAction : amendRecordAction}>
        <input type="hidden" name="recordId" value={record.id} />
        {/* Default for the Enter key, so it saves instead of hitting a Remove button. */}
        <button type="submit" name="intent" value="save" tabIndex={-1} aria-hidden="true"
          style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} />

        <h2>Header</h2>
        <div className="card">
          <div className="grid2">
            <label className="field">
              Prepared by
              <input name="prepared_by" defaultValue={record.prepared_by} />
            </label>
            <label className="field">
              Are all grades Offer vs. Serve?
              <select name="offer_vs_serve" defaultValue={record.offer_vs_serve ? "yes" : "no"}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            If no, explain why
            <input name="ovs_reason" defaultValue={record.ovs_reason} />
          </label>
          <h3 style={{ fontSize: 15, margin: "16px 0 6px" }}>Actual meal counts</h3>
          <div className="row">
            {MEAL_COUNTS.map(([k, label]) => (
              <label key={k} className="field">
                {label}
                <input type="number" min={0} name={k} defaultValue={record[k] || ""} />
              </label>
            ))}
            <div className="field">
              <span className="muted" style={{ fontSize: 13 }}>Total</span>
              <b style={{ padding: "6px 0", display: "block" }}>{mealCountTotal(record)}</b>
            </div>
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            Note any significant change in meal counts
            <input name="count_notes" defaultValue={record.count_notes} />
          </label>
        </div>

        <h2>Planned servings</h2>
        <p className="muted">Copied from district menu #{record.menu_no}. Change them to match what you are serving today.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item #</th><th>Description</th><th>Portion</th><th>HACCP</th>
                {PLANNED.map(([, l]) => <th key={l}>{l}</th>)}
                <th className="num">Total</th>{draft && <th></th>}
              </tr>
            </thead>
            <tbody>
              <Grouped lines={lines} cols={draft ? 11 : 10} row={(l) => (
                <tr key={l.id}>
                  <td>{l.item_no}</td>
                  <td className="wrap">{l.description}</td>
                  <td>{l.portion_size}</td>
                  <td>{l.haccp}</td>
                  {PLANNED.map(([k]) => (
                    <td key={k}><input className="xs" type="number" min={0} name={`l${l.id}.${k}`} defaultValue={l[k] || ""} aria-label={`${l.description} planned ${k}`} /></td>
                  ))}
                  <td className="num derived">{plannedTotal(l)}</td>
                  {draft && (
                    <td><button className="link" name="intent" value={`remove:${l.id}`} type="submit">Remove</button></td>
                  )}
                </tr>
              )} />
            </tbody>
          </table>
        </div>

        <h2>Counts from the paper Pull Sheet</h2>
        <p className="muted">
          After service, copy each row from the Pull Sheet. Amounts are in servings. The Production Record&apos;s
          actual servings are filled in from these numbers.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th><th>Item</th><th>Initials</th><th>Cases / cans / lb / bags</th>
                <th>Temp #1</th><th>Temp #2</th><th>Prepared</th><th>Used</th><th>Leftover</th>
                <th>Leftover code</th><th>Sold ALC / adult</th><th className="num">Served</th>
              </tr>
            </thead>
            <tbody>
              <Grouped lines={lines} cols={12} row={(l) => {
                const p = (k: string) => `l${l.id}.${k}`;
                return (
                  <tr key={l.id}>
                    <td>{l.item_no}</td>
                    <td className="wrap">{l.description}</td>
                    <td><input className="xs" name={p("initials")} defaultValue={l.ps.prepared_by_initials} maxLength={4} aria-label={`${l.description} initials`} /></td>
                    <td><input className="sm" name={p("qty_pulled")} defaultValue={l.ps.qty_pulled} aria-label={`${l.description} quantity pulled`} /> <span className="muted">{l.unit}</span></td>
                    <td><input className="xs" type="number" step="any" name={p("temp1")} defaultValue={v(l.ps.temp1)} aria-label={`${l.description} temp 1`} /></td>
                    <td><input className="xs" type="number" step="any" name={p("temp2")} defaultValue={v(l.ps.temp2)} aria-label={`${l.description} temp 2`} /></td>
                    <td><input className="xs" type="number" min={0} name={p("amount_prepared")} defaultValue={v(l.ps.amount_prepared)} aria-label={`${l.description} amount prepared`} /></td>
                    <td><input className="xs" type="number" min={0} name={p("amount_used")} defaultValue={v(l.ps.amount_used)} aria-label={`${l.description} amount used`} /></td>
                    <td><input className="xs" type="number" min={0} name={p("amount_leftover")} defaultValue={v(l.ps.amount_leftover)} aria-label={`${l.description} amount leftover`} /></td>
                    <td>
                      <select className="sm" name={p("leftover_code")} defaultValue={l.ps.leftover_code} aria-label={`${l.description} leftover code`}>
                        <option value="">—</option>
                        {LEFTOVER_CODES.map(([c, label]) => <option key={c} value={c}>{c} · {label}</option>)}
                      </select>
                    </td>
                    <td><input className="xs" type="number" min={0} name={p("num_sold_alc")} defaultValue={v(l.num_sold_alc)} aria-label={`${l.description} sold a la carte`} /></td>
                    <td className="num derived">{v(l.num_served) || "—"}</td>
                  </tr>
                );
              }} />
            </tbody>
          </table>
        </div>

        <h2>Checks</h2>
        <ValidationPanel result={validation} />

        {!draft && (
          <label className="field" style={{ marginTop: 12 }}>
            Reason for this amendment (required)
            <textarea name="reason" required placeholder="e.g. Recounted milk cartons; K-5 count was off by 2" />
          </label>
        )}

        <div className="actions">
          {draft ? (
            <>
              <button type="submit" name="intent" value="save">Save</button>
              <button type="submit" name="intent" value="finalize" className="secondary">Save and finalize</button>
            </>
          ) : (
            <button type="submit">Save amendment</button>
          )}
        </div>
      </form>

      {draft && (
        <div className="card">
          <form action={addLineAction} className="row">
            <input type="hidden" name="recordId" value={record.id} />
            <label className="field" style={{ minWidth: 320 }}>
              Add an item from the district catalog
              <select name="foodItemId">
                {CATEGORIES.map(([cat, label]) => (
                  <optgroup key={cat} label={label}>
                    {foodItems.filter((f) => f.category === cat && !lines.some((l) => l.food_item_id === f.id)).map((f) => (
                      <option key={f.id} value={f.id}>{f.item_no} {f.description}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="submit" className="secondary">Add item</button>
          </form>
          <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>Save your changes above first; adding an item reloads the page.</p>
        </div>
      )}
    </>
  );
}
