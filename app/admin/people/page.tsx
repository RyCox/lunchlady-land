import { requireAdmin } from "@/lib/auth";
import { listSchools, listUsers } from "@/lib/catalog";
import { Notice, type Search } from "@/components/Notice";
import { addSchoolAction, addUserAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const [schools, users] = await Promise.all([listSchools(), listUsers()]);
  return (
    <>
      <h1>Schools and users</h1>
      <Notice searchParams={searchParams} />
      <div className="grid2">
        <div>
          <h2>Schools</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Code</th></tr></thead>
              <tbody>{schools.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.code}</td></tr>)}</tbody>
            </table>
          </div>
          <form action={addSchoolAction} className="card row">
            <label className="field">Name<input name="name" required /></label>
            <label className="field">Code<input name="code" required style={{ width: 90 }} /></label>
            <button type="submit" className="secondary">Add school</button>
          </form>
        </div>
        <div>
          <h2>Users</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>School</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td>{u.email}</td>
                    <td>{u.role === "admin" ? "District admin" : "Cafeteria manager"}</td><td>{u.school_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={addUserAction} className="card">
            <div className="grid2">
              <label className="field">Name<input name="name" required /></label>
              <label className="field">Email<input type="email" name="email" required /></label>
              <label className="field">Role
                <select name="role" defaultValue="manager">
                  <option value="manager">Cafeteria manager</option><option value="admin">District admin</option>
                </select>
              </label>
              <label className="field">School (managers)
                <select name="schoolId">
                  <option value="">—</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <div className="actions"><button type="submit" className="secondary">Add user</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
