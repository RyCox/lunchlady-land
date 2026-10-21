import { listUsers } from "@/lib/catalog";
import { loginAction } from "../actions";

export default async function LoginPage() {
  const users = await listUsers();
  return (
    <div className="login card">
      <h1>Sign in</h1>
      <p className="muted">
        Proof of concept: pick a user. The real app signs in with the district&apos;s Google or Microsoft accounts.
      </p>
      <form action={loginAction} className="row">
        <label className="field" style={{ flex: 1 }}>
          User
          <select name="userId" defaultValue={users[0]?.id}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "admin" ? "District admin" : `Manager, ${u.school_name}`})
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
