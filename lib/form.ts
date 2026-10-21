import { redirect } from "next/navigation";
import { AppError } from "./records";

// FormData helpers for server actions.

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export const dec = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new AppError(`"${v}" is not a number.`);
  return n;
};

export const int = (fd: FormData, k: string) => {
  const n = dec(fd, k);
  return n == null ? null : Math.round(n);
};

/** Redirects back to a page with a message in the query string. */
export function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params)}`);
}
