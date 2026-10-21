import { CATEGORIES, CREDITABLE, LEFTOVER_CODES, MEAL_COUNTS, PLANNED } from "./constants";
import type { RecordWithLines } from "./types";
import { mealCountTotal, plannedTotal } from "./validate";

// Printable forms as standalone HTML. The same string is shown on the print
// page and stored (with a checksum) in record_archives when a record is
// finalized, so the archived copy matches what was printed.

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const num = (v: number | null | undefined) => (v == null ? "" : String(Number(v)));
const cr = (v: number) => (Number(v) ? String(Number(v)) : "");

const STYLE = `
  .form { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 10px; }
  .form h1 { font-size: 15px; margin: 0 0 4px; }
  .form .sub { font-size: 10px; margin-bottom: 8px; }
  .form .status { float: right; font-weight: bold; border: 1.5px solid #000; padding: 2px 6px; font-size: 11px; }
  .form .status.draft { color: #b00; border-color: #b00; }
  .form table { border-collapse: collapse; width: 100%; }
  .form th, .form td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; }
  .form th { background: #e6e6e6; font-weight: bold; text-align: center; }
  .form td.n { text-align: center; }
  .form tr.group td { background: #f2f2f2; font-weight: bold; text-transform: uppercase; }
  .form .hdr { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin-bottom: 8px; }
  .form .hdr div { border-bottom: 1px solid #000; padding: 2px 0; min-height: 14px; }
  .form .hdr .wide { grid-column: span 2; }
  .form .hdr .full { grid-column: span 4; }
  .form .hdr b { font-weight: bold; margin-right: 4px; }
  .form .counts { margin-bottom: 8px; }
  .form .counts td, .form .counts th { width: 12.5%; text-align: center; }
  .form .rules { margin-top: 6px; font-size: 9px; }
  .form .blank td { height: 22px; }
  .form.ps td { height: 30px; }
  .form .sig { margin-top: 10px; display: flex; gap: 24px; }
  .form .sig div { flex: 1; border-bottom: 1px solid #000; padding-top: 18px; }
  @media print { @page { size: letter landscape; margin: 0.35in; } }
`;

const MEAL = { breakfast: "Breakfast", lunch: "Lunch" } as const;

function statusBadge({ record }: RecordWithLines) {
  if (record.status === "draft") return `<span class="status draft">DRAFT - not final</span>`;
  const when = record.finalized_at ? `${record.finalized_at.slice(0, 16)} UTC` : "";
  return `<span class="status">FINALIZED v${record.version}${record.version > 1 ? " (amended)" : ""} · ${esc(record.finalized_by_name)} · ${esc(when)}</span>`;
}

export function renderProductionRecordHtml(data: RecordWithLines): string {
  const { record, lines } = data;
  const colCount = 4 + CREDITABLE.length + 1 + PLANNED.length + 1 + 6;

  const groups = CATEGORIES.map(([cat, label]) => {
    const rows = lines.filter((l) => l.category === cat);
    const body = rows.length
      ? rows
          .map(
            (l) => `<tr>
          <td class="n">${esc(l.item_no)}</td><td>${esc(l.description)}</td>
          <td class="n">${esc(l.haccp)}</td><td>${esc(l.portion_size)}</td>
          ${CREDITABLE.map(([k]) => `<td class="n">${cr(l[k])}</td>`).join("")}
          <td>${esc(l.source)}</td>
          ${PLANNED.map(([k]) => `<td class="n">${l[k] || ""}</td>`).join("")}
          <td class="n"><b>${plannedTotal(l)}</b></td>
          <td class="n">${esc(l.amt_prepared)}${l.amt_prepared ? ` ${esc(l.unit)}` : ""}</td>
          <td class="n">${num(l.num_prepared)}</td><td class="n">${num(l.num_served)}</td>
          <td class="n">${num(l.num_sold_alc)}</td><td class="n">${num(l.amt_leftover)}</td>
          <td class="n">${esc(l.code)}</td>
        </tr>`,
          )
          .join("")
      : `<tr class="blank"><td colspan="${colCount}"></td></tr>`;
    return `<tr class="group"><td colspan="${colCount}">${label}</td></tr>${body}`;
  }).join("");

  return `<div class="form"><style>${STYLE}</style>
  ${statusBadge(data)}
  <h1>Production Record</h1>
  <div class="sub">${MEAL[record.meal]} · Federally required record. Keep on file.</div>
  <div class="hdr">
    <div><b>Date:</b>${esc(record.record_date)}</div>
    <div class="wide"><b>School:</b>${esc(record.school_name)}</div>
    <div><b>Prepared By:</b>${esc(record.prepared_by)}</div>
    <div><b>Menu #:</b>${esc(record.menu_no)}</div>
    <div class="wide"><b>Menu Name:</b>${esc(record.menu_name)}</div>
    <div><b>All grades Offer vs. Serve:</b>${record.offer_vs_serve ? "YES" : "NO"}</div>
    <div class="full"><b>If NO, explain why:</b>${esc(record.ovs_reason)}</div>
  </div>
  <table class="counts">
    <tr><th colspan="8">Actual Meal Counts</th></tr>
    <tr>${MEAL_COUNTS.map(([, l]) => `<th>${l}</th>`).join("")}<th>Total</th><th>Notes on significant change</th></tr>
    <tr>${MEAL_COUNTS.map(([k]) => `<td>${record[k] || ""}</td>`).join("")}<td><b>${mealCountTotal(record) || ""}</b></td><td style="text-align:left">${esc(record.count_notes)}</td></tr>
  </table>
  <table>
    <thead>
      <tr>
        <th colspan="4">Food Item Info</th>
        <th colspan="${CREDITABLE.length + 1}">Creditable Size</th>
        <th colspan="${PLANNED.length + 1}">Planned Servings</th>
        <th colspan="6">Actual Servings</th>
      </tr>
      <tr>
        <th>Item #</th><th>Description of Food Items</th><th>HACCP</th><th>Actual Portion Size</th>
        ${CREDITABLE.map(([, l]) => `<th>${l}</th>`).join("")}<th>SOURC</th>
        ${PLANNED.map(([, l]) => `<th>${l}</th>`).join("")}<th>TOTAL</th>
        <th>Amt Prep'd (cases, cans, recipes)</th><th>Num Svg Prepared</th><th>Num Served</th>
        <th>Num Sold ALC, Adult</th><th>Amt Leftover</th><th>CODE</th>
      </tr>
    </thead>
    <tbody>${groups}</tbody>
  </table>
  <div class="rules">FRUIT: PK-8 offer a minimum of ½ cup fruit; 9-12 offer a minimum of 1 cup fruit. MILK: offer at least 2 types daily.
  Leftover codes: ${LEFTOVER_CODES.map(([c, l]) => `${c} = ${l}`).join(", ")}.</div>
  <div class="sig"><div>Manager signature</div><div>Date</div></div>
</div>`;
}

export function renderPullSheetHtml(data: RecordWithLines, opts: { blankRows?: number } = {}): string {
  const { record, lines } = data;
  const blank = `<td></td>`.repeat(8);
  const rows = lines
    .map((l) => `<tr><td class="n">${esc(l.item_no)}</td><td>${esc(l.description)} <small>(${esc(l.portion_size)})</small></td>${blank}</tr>`)
    .join("");
  const extra = `<tr><td></td><td></td>${blank}</tr>`.repeat(opts.blankRows ?? 4);

  return `<div class="form ps"><style>${STYLE}</style>
  <h1>Pull Sheet / Temp Log / Leftover Usage</h1>
  <div class="sub">${MEAL[record.meal]} · Menu #${esc(record.menu_no)} ${esc(record.menu_name)}</div>
  <div class="hdr">
    <div class="wide"><b>School Name:</b>${esc(record.school_name)}</div>
    <div><b>Date:</b>${esc(record.record_date)}</div>
    <div><b>Meal:</b>${MEAL[record.meal]}</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:6%">Code</th><th style="width:26%">${MEAL[record.meal]} Item</th>
      <th style="width:7%">Prepared By (Initials)</th><th style="width:10%">Cases / Cans / Pounds / Bags</th>
      <th style="width:7%">Temp #1</th><th style="width:7%">Temp #2</th>
      <th style="width:8%">Amount Prepared</th><th style="width:8%">Amount Used</th>
      <th style="width:8%">Amount Leftover</th><th style="width:13%">Leftover Usage Code F / R / SND / D</th>
    </tr></thead>
    <tbody>${rows}${extra}</tbody>
  </table>
  <div class="rules">Leftover usage codes: ${LEFTOVER_CODES.map(([c, l]) => `<b>${c}</b> = ${l}`).join(" · ")}. Record amounts in servings. Return this sheet to the manager after service.</div>
</div>`;
}
