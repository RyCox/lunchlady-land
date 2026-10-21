import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { logoutAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lunchlady Land",
  description: "Production Records and Pull Sheets for school cafeterias",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="inner">
            <Link href="/" className="brand">Lunchlady Land</Link>
            {user && (
              <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Link href="/">Records</Link>
                <Link href="/catalog">Food items</Link>
                {user.role === "admin" && (
                  <>
                    <Link href="/admin/menus">Menus</Link>
                    <Link href="/admin/people">Schools &amp; users</Link>
                    <Link href="/admin/audit">Audit log</Link>
                  </>
                )}
              </nav>
            )}
            {user && (
              <div className="who">
                <span>
                  {user.name} · {user.role === "admin" ? "District admin" : `Manager, ${user.school_name}`}
                </span>
                <form action={logoutAction}>
                  <button type="submit">Sign out</button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
