import { MEAL_COUNTS, PLANNED } from "./constants";
import type { ProductionRecord, PullSheetLine, RecordLine } from "./types";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// USDA fruit minimums the PRD lists, in cups offered per day.
export const FRUIT_MIN_PK8 = 0.5;
export const FRUIT_MIN_912 = 1;

export function plannedTotal(line: Pick<RecordLine, (typeof PLANNED)[number][0]>) {
  return PLANNED.reduce((sum, [k]) => sum + (line[k] ?? 0), 0);
}

export function mealCountTotal(record: Pick<ProductionRecord, (typeof MEAL_COUNTS)[number][0]>) {
  return MEAL_COUNTS.reduce((sum, [k]) => sum + (record[k] ?? 0), 0);
}

/**
 * Production Record actuals come from the Pull Sheet so nobody types the
 * same number twice. Served = used minus the à la carte / adult sales.
 */
export function deriveActuals(ps: PullSheetLine, soldAlc: number | null) {
  const used = ps.amount_used;
  return {
    amt_prepared: ps.qty_pulled,
    num_prepared: ps.amount_prepared,
    num_served: used == null ? null : Math.max(0, used - (soldAlc ?? 0)),
    amt_leftover: ps.amount_leftover,
    code: ps.leftover_code,
  };
}

function fruitOffered(lines: RecordLine[], keys: (typeof PLANNED)[number][0][]) {
  return lines
    .filter((l) => l.cr_fruit > 0 && keys.some((k) => l[k] > 0))
    .reduce((sum, l) => sum + Number(l.cr_fruit), 0);
}

/** Checks a record before it is finalized. Errors block finalizing; warnings do not. */
export function validateRecord(record: ProductionRecord, lines: RecordLine[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!record.prepared_by.trim()) errors.push("Enter who prepared the record.");
  if (!record.offer_vs_serve && !record.ovs_reason.trim())
    errors.push("Explain why not all grades are Offer vs. Serve.");
  if (mealCountTotal(record) === 0) errors.push("Enter the actual meal counts.");
  if (lines.length === 0) errors.push("Add at least one food item.");

  const milks = new Set(lines.filter((l) => l.category === "milk").map((l) => l.item_no));
  if (milks.size < 2) errors.push(`Offer at least 2 types of milk (${milks.size} listed).`);

  const servesPk8 = lines.some((l) => l.planned_pk + l.planned_k5 + l.planned_k8 > 0);
  const serves912 = lines.some((l) => l.planned_912 > 0);
  const fruitPk8 = fruitOffered(lines, ["planned_pk", "planned_k5", "planned_k8"]);
  const fruit912 = fruitOffered(lines, ["planned_912"]);
  if (servesPk8 && fruitPk8 < FRUIT_MIN_PK8)
    errors.push(`PK-8 must be offered at least ½ cup fruit (${fruitPk8} cup planned).`);
  if (serves912 && fruit912 < FRUIT_MIN_912)
    errors.push(`9-12 must be offered at least 1 cup fruit (${fruit912} cup planned).`);

  for (const l of lines) {
    const name = `${l.item_no} ${l.description}`;
    const ps = l.ps;
    if (ps.amount_prepared == null || ps.amount_used == null) {
      errors.push(`${name}: enter Amount Prepared and Amount Used from the Pull Sheet.`);
      continue;
    }
    const leftover = ps.amount_leftover ?? 0;
    if (leftover > 0 && !ps.leftover_code)
      errors.push(`${name}: choose a leftover usage code (F, R, SND or D).`);
    if (ps.amount_used + leftover !== ps.amount_prepared)
      warnings.push(
        `${name}: used (${ps.amount_used}) + leftover (${leftover}) does not equal prepared (${ps.amount_prepared}).`,
      );
    if ((l.num_sold_alc ?? 0) > ps.amount_used)
      warnings.push(`${name}: sold à la carte/adult is more than the amount used.`);
    if ((l.haccp === "2" || l.haccp === "3") && (ps.temp1 == null || ps.temp2 == null))
      warnings.push(`${name}: HACCP ${l.haccp} item is missing a temperature reading.`);
    if (!ps.prepared_by_initials.trim() && l.category === "general")
      warnings.push(`${name}: no preparer initials.`);
  }

  return { errors, warnings };
}
