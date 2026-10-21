"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, signIn, signOut } from "@/lib/auth";
import { MEAL_COUNTS, PLANNED } from "@/lib/constants";
import { back, dec, int, str } from "@/lib/form";
import {
  AppError, addLine, amendRecord, createRecord, finalizeRecord, getRecord, removeLine, saveDraft,
  type HeaderInput, type LineInput,
} from "@/lib/records";

export async function loginAction(fd: FormData) {
  await signIn(Number(fd.get("userId")));
  redirect("/");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

export async function createRecordAction(fd: FormData) {
  const user = await requireUser();
  let id: number;
  try {
    id = await createRecord(user, {
      schoolId: user.role === "admin" ? Number(fd.get("schoolId")) : user.school_id!,
      date: str(fd, "date"),
      meal: str(fd, "meal") as "breakfast" | "lunch",
      menuId: Number(fd.get("menuId")),
    });
  } catch (e) {
    if (e instanceof AppError) back("/", { error: e.message });
    throw e;
  }
  redirect(`/records/${id}`);
}

function parseRecordForm(fd: FormData, lineIds: number[]): { header: HeaderInput; lines: LineInput[] } {
  const header = {
    prepared_by: str(fd, "prepared_by"),
    offer_vs_serve: str(fd, "offer_vs_serve") === "yes",
    ovs_reason: str(fd, "ovs_reason"),
    count_notes: str(fd, "count_notes"),
    ...Object.fromEntries(MEAL_COUNTS.map(([k]) => [k, int(fd, k) ?? 0])),
  } as HeaderInput;
  const lines = lineIds.map((id) => {
    const p = (k: string) => `l${id}.${k}`;
    return {
      id,
      ...Object.fromEntries(PLANNED.map(([k]) => [k, int(fd, p(k)) ?? 0])),
      num_sold_alc: int(fd, p("num_sold_alc")),
      ps: {
        prepared_by_initials: str(fd, p("initials")).toUpperCase(),
        qty_pulled: str(fd, p("qty_pulled")),
        temp1: dec(fd, p("temp1")),
        temp2: dec(fd, p("temp2")),
        amount_prepared: int(fd, p("amount_prepared")),
        amount_used: int(fd, p("amount_used")),
        amount_leftover: int(fd, p("amount_leftover")),
        leftover_code: str(fd, p("leftover_code")),
      },
    } as LineInput;
  });
  return { header, lines };
}

export async function saveRecordAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("recordId"));
  const intent = str(fd, "intent");
  const path = `/records/${id}`;
  try {
    const data = await getRecord(user, id);
    if (!data) throw new AppError("Record not found.");
    const { header, lines } = parseRecordForm(fd, data.lines.map((l) => l.id));
    await saveDraft(user, id, header, lines);
    if (intent.startsWith("remove:")) {
      await removeLine(user, id, Number(intent.slice(7)));
      back(path, { msg: "Item removed." });
    }
    if (intent === "finalize") {
      const result = await finalizeRecord(user, id);
      if (!result.ok) back(path, { error: "Fix the problems below before finalizing." });
      revalidatePath(path);
      back(path, { msg: "Finalized and locked. A copy was archived." });
    }
  } catch (e) {
    if (e instanceof AppError) back(path, { error: e.message });
    throw e;
  }
  back(path, { msg: "Saved." });
}

export async function addLineAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("recordId"));
  try {
    await addLine(user, id, Number(fd.get("foodItemId")));
  } catch (e) {
    if (e instanceof AppError) back(`/records/${id}`, { error: e.message });
    throw e;
  }
  back(`/records/${id}`, { msg: "Item added." });
}

export async function amendRecordAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("recordId"));
  let version: number;
  try {
    const data = await getRecord(user, id);
    if (!data) throw new AppError("Record not found.");
    const { header, lines } = parseRecordForm(fd, data.lines.map((l) => l.id));
    ({ version } = await amendRecord(user, id, header, lines, str(fd, "reason")));
  } catch (e) {
    if (e instanceof AppError) back(`/records/${id}/amend`, { error: e.message });
    throw e;
  }
  back(`/records/${id}`, { msg: `Amendment saved as version ${version}.` });
}
