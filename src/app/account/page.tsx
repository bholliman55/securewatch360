import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <main>
      <h1>Account</h1>
      <p>Server-side auth context check (starter foundation).</p>

      {user ? (
        <table className="sw-table">
          <tbody>
            <tr>
              <th>User ID</th>
              <td>{user.id}</td>
            </tr>
            <tr>
              <th>Email</th>
              <td>{user.email ?? "-"}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p>
          No active session. <Link href="/login">Login</Link>
        </p>
      )}

      <p>
        <Link href="/login">Login</Link> | <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
