import "server-only";
import crypto from "node:crypto";
import { CREDITABLE, MEAL_COUNTS, PLANNED } from "./constants";
import { getDb, withTx, type Queryable } from "./db";
import { renderProductionRecordHtml } from "./print";
import type { ProductionRecord, PullSheetLine, RecordLine, RecordWithLines, User } from "./types";
import { deriveActuals, validateRecord } from "./validate";

export class AppError extends Error {}

const RECORD_SELECT = `
  select r.id, r.school_id, s.name as school_name, r.record_date::text as record_date, r.meal,
         r.menu_id, r.menu_no, r.menu_name, r.prepared_by, r.offer_vs_serve, r.ovs_reason,
         ${MEAL_COUNTS.map(([k]) => `r.${k}`).join(", ")}, r.count_notes, r.status, r.version,
         r.finalized_at::text as finalized_at, f.name as finalized_by_name
  from production_records r
  join schools s on s.id = r.school_id
  left join users f on f.id = r.finalized_by`;

const LINE_SELECT = `
  select l.*, p.prepared_by_initials, p.qty_pulled, p.temp1, p.temp2, p.amount_prepared,
         p.amount_used, p.amount_leftover, p.leftover_code
  from production_record_lines l
  left join pull_sheet_lines p on p.record_line_id = l.id`;

const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));

function toLine(row: Record<string, unknown>): RecordLine {
  const line = { ...row } as Record<string, unknown>;
  for (const [k] of CREDITABLE) line[k] = Number(row[k]);
  line.ps = {
    prepared_by_initials: (row.prepared_by_initials as string) ?? "",
    qty_pulled: (row.qty_pulled as string) ?? "",
    temp1: numOrNull(row.temp1),
    temp2: numOrNull(row.temp2),
    amount_prepared: numOrNull(row.amount_prepared),
    amount_used: numOrNull(row.amount_used),
    amount_leftover: numOrNull(row.amount_leftover),
    leftover_code: (row.leftover_code as string) ?? "",
  } satisfies PullSheetLine;
  return line as unknown as RecordLine;
}

const CATEGORY_ORDER = "case l.category when 'general' then 0 when 'fruit' then 1 when 'milk' then 2 else 3 end";

async function loadRecord(q: Queryable, id: number): Promise<RecordWithLines | null> {
  const { rows } = await q.query<ProductionRecord>(`${RECORD_SELECT} where r.id = $1`, [id]);
  if (!rows[0]) return null;
  const lines = await q.query(`${LINE_SELECT} where l.record_id = $1 order by ${CATEGORY_ORDER}, l.sort, l.id`, [id]);
  return { record: rows[0], lines: lines.rows.map(toLine) };
}

function assertAccess(user: User, schoolId: number) {
  if (user.role !== "admin" && user.school_id !== schoolId)
    throw new AppError("You can only work with your own school's records.");
}

export async function getRecord(user: User, id: number): Promise<RecordWithLines | null> {
  const data = await loadRecord(await getDb(), id);
  if (data) assertAccess(user, data.record.school_id);
  return data;
}

export async function listRecords(user: User, opts: { schoolId?: number; limit?: number } = {}) {
  const db = await getDb();
  const schoolId = user.role === "admin" ? opts.schoolId : user.school_id!;
  const { rows } = await db.query<ProductionRecord>(
    `${RECORD_SELECT} ${schoolId ? "where r.school_id = $1" : ""}
     order by r.record_date desc, r.meal, s.name limit ${opts.limit ?? 100}`,
    schoolId ? [schoolId] : [],
  );
  return rows;
}

async function insertLine(tx: Queryable, recordId: number, foodItemId: number, planned: Partial<Record<string, number>>, sort: number) {
  const cols = ["item_no", "description", "haccp", "portion_size", "category", "unit", "source", ...CREDITABLE.map(([k]) => k)];
  const { rows } = await tx.query<{ id: number }>(
    `insert into production_record_lines
       (record_id, food_item_id, ${cols.join(", ")}, ${PLANNED.map(([k]) => k).join(", ")}, sort)
     select $1, f.id, ${cols.map((c) => `f.${c}`).join(", ")}, $3, $4, $5, $6, $7, $8
     from food_items f where f.id = $2 returning id`,
    [recordId, foodItemId, ...PLANNED.map(([k]) => planned[k] ?? 0), sort],
  );
  if (!rows[0]) throw new AppError("Food item not found.");
  await tx.query("insert into pull_sheet_lines (record_line_id) values ($1)", [rows[0].id]);
}

/** Starts a day's Production Record from a district menu. */
export async function createRecord(
  user: User,
  input: { schoolId: number; date: string; meal: "breakfast" | "lunch"; menuId: number },
): Promise<number> {
  assertAccess(user, input.schoolId);
  return withTx(user.id, async (tx) => {
    const menu = (await tx.query<{ id: number; menu_no: number; name: string; meal: string }>(
      "select id, menu_no, name, meal from menus where id = $1 and active", [input.menuId])).rows[0];
    if (!menu) throw new AppError("Menu not found.");
    const existing = await tx.query(
      "select id from production_records where school_id = $1 and record_date = $2 and meal = $3",
      [input.schoolId, input.date, input.meal]);
    if (existing.rows.length) throw new AppError(`A ${input.meal} record for ${input.date} already exists.`);

    const { rows } = await tx.query<{ id: number }>(
      `insert into production_records (school_id, record_date, meal, menu_id, menu_no, menu_name, prepared_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [input.schoolId, input.date, input.meal, menu.id, menu.menu_no, menu.name, user.name]);
    const recordId = rows[0].id;
    const items = await tx.query<Record<string, number>>(
      "select * from menu_items where menu_id = $1 order by sort, id", [menu.id]);
    for (const mi of items.rows) await insertLine(tx, recordId, mi.food_item_id, mi, mi.sort);
    return recordId;
  });
}

async function draftForUpdate(tx: Queryable, user: User, recordId: number) {
  const data = await loadRecord(tx, recordId);
  if (!data) throw new AppError("Record not found.");
  assertAccess(user, data.record.school_id);
  if (data.record.status !== "draft") throw new AppError("This record is finalized. Use an amendment to change it.");
  return data;
}

export async function addLine(user: User, recordId: number, foodItemId: number) {
  await withTx(user.id, async (tx) => {
    const { lines } = await draftForUpdate(tx, user, recordId);
    if (lines.some((l) => l.food_item_id === foodItemId)) throw new AppError("That item is already on the record.");
    await insertLine(tx, recordId, foodItemId, {}, lines.length);
  });
}

export async function removeLine(user: User, recordId: number, lineId: number) {
  await withTx(user.id, async (tx) => {
    await draftForUpdate(tx, user, recordId);
    await tx.query("delete from pull_sheet_lines where record_line_id = $1", [lineId]);
    await tx.query("delete from production_record_lines where id = $1 and record_id = $2", [lineId, recordId]);
  });
}

export type HeaderInput = Pick<ProductionRecord, "prepared_by" | "offer_vs_serve" | "ovs_reason" | "count_notes" | (typeof MEAL_COUNTS)[number][0]>;
export type LineInput = { id: number; num_sold_alc: number | null; ps: PullSheetLine } & Record<(typeof PLANNED)[number][0], number>;

const HEADER_FIELDS = ["prepared_by", "offer_vs_serve", "ovs_reason", "count_notes", ...MEAL_COUNTS.map(([k]) => k)] as const;
const LINE_FIELDS = [...PLANNED.map(([k]) => k), "num_sold_alc"] as const;
const PS_FIELDS = ["prepared_by_initials", "qty_pulled", "temp1", "temp2", "amount_prepared", "amount_used", "amount_leftover", "leftover_code"] as const;

async function writeValues(tx: Queryable, recordId: number, header: HeaderInput, lines: LineInput[], known: RecordLine[]) {
  await tx.query(
    `update production_records set ${HEADER_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")} where id = $1`,
    [recordId, ...HEADER_FIELDS.map((f) => header[f])]);
  for (const input of lines) {
    if (!known.some((l) => l.id === input.id)) throw new AppError("Line does not belong to this record.");
    await tx.query(
      `update pull_sheet_lines set ${PS_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")} where record_line_id = $1`,
      [input.id, ...PS_FIELDS.map((f) => input.ps[f])]);
    const actuals = deriveActuals(input.ps, input.num_sold_alc);
    const values = { ...Object.fromEntries(LINE_FIELDS.map((f) => [f, input[f]])), ...actuals };
    const keys = Object.keys(values);
    await tx.query(
      `update production_record_lines set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`,
      [input.id, ...keys.map((k) => values[k as keyof typeof values])]);
  }
}

export async function saveDraft(user: User, recordId: number, header: HeaderInput, lines: LineInput[]) {
  await withTx(user.id, async (tx) => {
    const data = await draftForUpdate(tx, user, recordId);
    await writeValues(tx, recordId, header, lines, data.lines);
  });
}

async function archive(tx: Queryable, user: User, recordId: number) {
  const data = (await loadRecord(tx, recordId))!;
  const html = renderProductionRecordHtml(data);
  const sha256 = crypto.createHash("sha256").update(html).digest("hex");
  await tx.query(
    "insert into record_archives (record_id, version, html, sha256, created_by) values ($1, $2, $3, $4, $5)",
    [recordId, data.record.version, html, sha256, user.id]);
}

/** Locks the record after checking it. Returns the validation result either way. */
export async function finalizeRecord(user: User, recordId: number) {
  return withTx(user.id, async (tx) => {
    const data = await draftForUpdate(tx, user, recordId);
    const result = validateRecord(data.record, data.lines);
    if (result.errors.length) return { ok: false as const, ...result };
    await tx.query(
      "update production_records set status = 'finalized', finalized_at = now(), finalized_by = $2 where id = $1",
      [recordId, user.id]);
    await archive(tx, user, recordId);
    return { ok: true as const, ...result };
  });
}

type Change = { field: string; line?: string; from: unknown; to: unknown };

function diff(data: RecordWithLines, header: HeaderInput, lines: LineInput[]): Change[] {
  const changes: Change[] = [];
  const same = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");
  for (const f of HEADER_FIELDS)
    if (!same(data.record[f], header[f])) changes.push({ field: f, from: data.record[f], to: header[f] });
  for (const input of lines) {
    const old = data.lines.find((l) => l.id === input.id);
    if (!old) continue;
    const label = `${old.item_no} ${old.description}`;
    for (const f of LINE_FIELDS)
      if (!same(old[f], input[f])) changes.push({ field: f, line: label, from: old[f], to: input[f] });
    for (const f of PS_FIELDS)
      if (!same(old.ps[f], input.ps[f])) changes.push({ field: `pull_sheet.${f}`, line: label, from: old.ps[f], to: input.ps[f] });
  }
  return changes;
}

/** Changes a finalized record. Keeps the old values in the amendment and re-archives the printout. */
export async function amendRecord(user: User, recordId: number, header: HeaderInput, lines: LineInput[], reason: string) {
  if (!reason.trim()) throw new AppError("An amendment needs a reason.");
  return withTx(user.id, async (tx) => {
    const data = await loadRecord(tx, recordId);
    if (!data) throw new AppError("Record not found.");
    assertAccess(user, data.record.school_id);
    if (data.record.status !== "finalized") throw new AppError("Only finalized records are amended. Edit the draft instead.");
    const changes = diff(data, header, lines);
    if (!changes.length) throw new AppError("Nothing changed.");

    await writeValues(tx, recordId, header, lines, data.lines);
    const updated = (await loadRecord(tx, recordId))!;
    const result = validateRecord(updated.record, updated.lines);
    if (result.errors.length) throw new AppError(`The amended record has problems: ${result.errors.join(" ")}`);

    const version = data.record.version + 1;
    await tx.query("update production_records set version = $2 where id = $1", [recordId, version]);
    await tx.query(
      "insert into amendments (record_id, version, reason, changes, amended_by) values ($1, $2, $3, $4, $5)",
      [recordId, version, reason.trim(), JSON.stringify(changes), user.id]);
    await archive(tx, user, recordId);
    return { version, changes, warnings: result.warnings };
  }, { reason, amending: true });
}

export async function listAmendments(user: User, recordId: number) {
  await getRecord(user, recordId);
  const db = await getDb();
  const { rows } = await db.query<{ id: number; version: number; reason: string; changes: Change[] | string; amended_by_name: string; amended_at: string }>(
    `select a.id, a.version, a.reason, a.changes, u.name as amended_by_name, a.amended_at::text as amended_at
     from amendments a join users u on u.id = a.amended_by where a.record_id = $1 order by a.version`, [recordId]);
  return rows.map((r) => ({ ...r, changes: (typeof r.changes === "string" ? JSON.parse(r.changes) : r.changes) as Change[] }));
}

export async function listArchives(user: User, recordId: number) {
  await getRecord(user, recordId);
  const db = await getDb();
  const { rows } = await db.query<{ version: number; sha256: string; created_at: string; created_by_name: string }>(
    `select a.version, a.sha256, a.created_at::text as created_at, u.name as created_by_name
     from record_archives a join users u on u.id = a.created_by where a.record_id = $1 order by a.version`, [recordId]);
  return rows;
}

export async function getArchive(user: User, recordId: number, version: number) {
  await getRecord(user, recordId);
  const db = await getDb();
  const { rows } = await db.query<{ html: string; sha256: string }>(
    "select html, sha256 from record_archives where record_id = $1 and version = $2", [recordId, version]);
  return rows[0] ?? null;
}
