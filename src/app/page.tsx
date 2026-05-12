import { redirect } from "next/navigation";

/**
 * Root route — middleware handles unauthenticated users (redirects to /login).
 * Authenticated users land here and are sent directly to the console.
 */
export default function RootPage() {
  redirect("/console");
}
