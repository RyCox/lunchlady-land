import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppError, getRecord } from "@/lib/records";

export async function loadRecordPage(params: Promise<{ id: string }>) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  try {
    const data = await getRecord(user, id);
    if (!data) notFound();
    return { user, data };
  } catch (e) {
    if (e instanceof AppError) redirect(`/?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
}
