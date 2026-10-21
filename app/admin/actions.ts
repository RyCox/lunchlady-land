"use server";

import { requireAdmin } from "@/lib/auth";
import {
  addMenuItem, addSchool, addUser, removeMenuItem, saveFoodItem, saveMenu, saveMenuItems,
} from "@/lib/catalog";
import { CREDITABLE, PLANNED, type Category } from "@/lib/constants";
import { back, dec, int, str } from "@/lib/form";
import { AppError } from "@/lib/records";

async function attempt(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) back(path, { error: e.message });
    throw e;
  }
}

export async function saveFoodItemAction(fd: FormData) {
  const user = await requireAdmin();
  const id = int(fd, "id");
  const path = `/admin/items/${id ?? "new"}`;
  let savedId = id;
  await attempt(path, async () => {
    savedId = await saveFoodItem(user, id, {
      item_no: str(fd, "item_no"),
      description: str(fd, "description"),
      haccp: str(fd, "haccp"),
      portion_size: str(fd, "portion_size"),
      category: str(fd, "category") as Category,
      unit: str(fd, "unit"),
      source: str(fd, "source"),
      active: fd.get("active") === "on",
      ...(Object.fromEntries(CREDITABLE.map(([k]) => [k, dec(fd, k) ?? 0])) as Record<(typeof CREDITABLE)[number][0], number>),
    });
  });
  back(`/admin/items/${savedId}`, { msg: "Saved." });
}

export async function saveMenuAction(fd: FormData) {
  const user = await requireAdmin();
  const id = int(fd, "id");
  let savedId = id;
  await attempt(`/admin/menus/${id ?? "new"}`, async () => {
    savedId = await saveMenu(user, id, {
      menu_no: int(fd, "menu_no") ?? NaN,
      name: str(fd, "name"),
      meal: str(fd, "meal") as "breakfast" | "lunch",
      active: fd.get("active") === "on",
    });
  });
  back(`/admin/menus/${savedId}`, { msg: "Saved." });
}

export async function saveMenuItemsAction(fd: FormData) {
  const user = await requireAdmin();
  const menuId = Number(fd.get("menuId"));
  const path = `/admin/menus/${menuId}`;
  const ids = fd.getAll("itemId").map(Number);
  await attempt(path, () =>
    saveMenuItems(user, menuId, ids.map((id) => ({
      id,
      ...(Object.fromEntries(PLANNED.map(([k]) => [k, int(fd, `i${id}.${k}`) ?? 0])) as Record<(typeof PLANNED)[number][0], number>),
    }))));
  const remove = str(fd, "intent");
  if (remove.startsWith("remove:")) {
    await attempt(path, () => removeMenuItem(user, menuId, Number(remove.slice(7))));
    back(path, { msg: "Item removed." });
  }
  back(path, { msg: "Planned servings saved." });
}

export async function addMenuItemAction(fd: FormData) {
  const user = await requireAdmin();
  const menuId = Number(fd.get("menuId"));
  await attempt(`/admin/menus/${menuId}`, () => addMenuItem(user, menuId, Number(fd.get("foodItemId"))));
  back(`/admin/menus/${menuId}`, { msg: "Item added. Set its planned servings below." });
}

export async function addSchoolAction(fd: FormData) {
  const user = await requireAdmin();
  await attempt("/admin/people", () => addSchool(user, str(fd, "name"), str(fd, "code")));
  back("/admin/people", { msg: "School added." });
}

export async function addUserAction(fd: FormData) {
  const user = await requireAdmin();
  await attempt("/admin/people", () =>
    addUser(user, {
      name: str(fd, "name"),
      email: str(fd, "email"),
      role: str(fd, "role") as "admin" | "manager",
      schoolId: int(fd, "schoolId"),
    }));
  back("/admin/people", { msg: "User added." });
}
