import { beforeEach, describe, expect, it } from "vitest";
import { getDb, openDb, setDb } from "@/lib/db";
import { getUserById } from "@/lib/auth";
import {
  addLine, amendRecord, createRecord, finalizeRecord, getArchive, getRecord, listAmendments,
  saveDraft, type HeaderInput, type LineInput,
} from "@/lib/records";
import { listAudit, listFoodItems, listMenus } from "@/lib/catalog";
import type { RecordWithLines, User } from "@/lib/types";

let admin: User;
let maria: User; // manager at Maple Elementary
let jim: User; // manager at Riverside K-8

beforeEach(async () => {
  setDb(openDb({ memory: true }));
  admin = (await getUserById(1))!;
  maria = (await getUserById(2))!;
  jim = (await getUserById(3))!;
});

async function nuggetDay() {
  const menu = (await listMenus()).find((m) => m.menu_no === 101)!;
  return createRecord(maria, { schoolId: maria.school_id!, date: "2026-10-20", meal: "lunch", menuId: menu.id });
}

function filledInputs(data: RecordWithLines): { header: HeaderInput; lines: LineInput[] } {
  const header: HeaderInput = {
    prepared_by: "Maria Lopez", offer_vs_serve: true, ovs_reason: "", count_notes: "",
    count_pk: 18, count_k5: 170, count_k8: 0, count_912: 0, count_adults: 4, count_staff: 6,
  };
  const lines = data.lines.map((l) => ({
    id: l.id,
    planned_pk: l.planned_pk, planned_k5: l.planned_k5, planned_k8: l.planned_k8,
    planned_912: l.planned_912, planned_other: l.planned_other,
    num_sold_alc: 2,
    ps: {
      prepared_by_initials: "ML", qty_pulled: "2", temp1: 165, temp2: 160,
      amount_prepared: 100, amount_used: 90, amount_leftover: 10, leftover_code: "R",
    },
  }));
  return { header, lines };
}

describe("production records", () => {
  it("creates a draft from the menu, sorted with milk and fruit lines", async () => {
    const id = await nuggetDay();
    const data = (await getRecord(maria, id))!;
    expect(data.record.status).toBe("draft");
    expect(data.record.menu_name).toBe("Nugget Day");
    expect(data.lines.map((l) => l.category)).toEqual([
      "general", "general", "general", "general", "fruit", "fruit", "milk", "milk", "condiment",
    ]);
  });

  it("keeps managers to their own school", async () => {
    const id = await nuggetDay();
    await expect(getRecord(jim, id)).rejects.toThrow(/own school/);
    expect(await getRecord(admin, id)).not.toBeNull();
  });

  it("blocks finalizing until the Pull Sheet and header are filled in", async () => {
    const id = await nuggetDay();
    const result = await finalizeRecord(maria, id);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/meal counts/);
    expect(result.errors.join(" ")).toMatch(/Amount Prepared/);
  });

  it("derives actual servings from the Pull Sheet, then locks on finalize", async () => {
    const id = await nuggetDay();
    const { header, lines } = filledInputs((await getRecord(maria, id))!);
    await saveDraft(maria, id, header, lines);
    const saved = (await getRecord(maria, id))!;
    expect(saved.lines[0]).toMatchObject({ num_prepared: 100, num_served: 88, amt_leftover: 10, code: "R", amt_prepared: "2" });

    const result = await finalizeRecord(maria, id);
    expect(result).toMatchObject({ ok: true, errors: [] });
    const final = (await getRecord(maria, id))!;
    expect(final.record.status).toBe("finalized");

    await expect(saveDraft(maria, id, header, lines)).rejects.toThrow(/finalized/);
    // The database refuses direct edits too, not just the app.
    const db = await getDb();
    await expect(db.query("update production_record_lines set num_served = 1 where record_id = $1", [id])).rejects.toThrow(/finalized/);
    await expect(db.query("delete from production_records where id = $1", [id])).rejects.toThrow(/cannot be deleted/);

    const archive = (await getArchive(maria, id, 1))!;
    expect(archive.html).toContain("FINALIZED v1");
    expect(archive.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("enforces the milk and fruit rules", async () => {
    const id = await nuggetDay();
    let data = (await getRecord(maria, id))!;
    const { header } = filledInputs(data);
    // Drop to one milk and no fruit.
    const db = await getDb();
    await db.query("delete from pull_sheet_lines where record_line_id in (select id from production_record_lines where record_id = $1 and category in ('fruit') or (record_id = $1 and item_no = '3002'))", [id]);
    await db.query("delete from production_record_lines where record_id = $1 and (category = 'fruit' or item_no = '3002')", [id]);
    data = (await getRecord(maria, id))!;
    await saveDraft(maria, id, header, filledInputs(data).lines);
    const result = await finalizeRecord(maria, id);
    expect(result.errors.join(" ")).toMatch(/2 types of milk/);
    expect(result.errors.join(" ")).toMatch(/½ cup fruit/);

    const milk = (await listFoodItems()).find((f) => f.item_no === "3003")!;
    const apple = (await listFoodItems()).find((f) => f.item_no === "2001")!;
    await addLine(maria, id, milk.id);
    await addLine(maria, id, apple.id);
    data = (await getRecord(maria, id))!;
    const inputs = filledInputs(data).lines.map((l) =>
      data.lines.find((d) => d.id === l.id)!.item_no === "2001" ? { ...l, planned_k5: 100 } : l);
    await saveDraft(maria, id, header, inputs);
    expect((await finalizeRecord(maria, id)).ok).toBe(true);
  });

  it("amends a finalized record with a reason and keeps history", async () => {
    const id = await nuggetDay();
    const { header, lines } = filledInputs((await getRecord(maria, id))!);
    await saveDraft(maria, id, header, lines);
    await finalizeRecord(maria, id);

    await expect(amendRecord(maria, id, header, lines, "")).rejects.toThrow(/reason/);
    await expect(amendRecord(maria, id, header, lines, "no-op")).rejects.toThrow(/Nothing changed/);

    const changed = lines.map((l, i) => (i === 0 ? { ...l, ps: { ...l.ps, amount_used: 95, amount_leftover: 5 } } : l));
    const result = await amendRecord(maria, id, { ...header, count_k5: 172 }, changed, "Recounted trays");
    expect(result.version).toBe(2);
    expect(result.changes.map((c) => c.field)).toEqual(["count_k5", "pull_sheet.amount_used", "pull_sheet.amount_leftover"]);

    const after = (await getRecord(maria, id))!;
    expect(after.record).toMatchObject({ status: "finalized", version: 2, count_k5: 172 });
    expect(after.lines[0].num_served).toBe(93);

    const amendments = await listAmendments(maria, id);
    expect(amendments[0]).toMatchObject({ version: 2, reason: "Recounted trays" });
    expect((await getArchive(maria, id, 1))!.html).toContain("FINALIZED v1");
    expect((await getArchive(maria, id, 2))!.html).toContain("FINALIZED v2 (amended)");

    const audit = await listAudit(admin, { recordId: id });
    expect(audit.some((a) => a.reason === "Recounted trays" && a.user_name === "Maria Lopez")).toBe(true);
  });
});
