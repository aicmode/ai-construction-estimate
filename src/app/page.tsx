import { redirect } from "next/navigation";

/**
 * The proxy (src/proxy.ts) already routes unauthenticated visitors to /login, so the
 * root path only needs to forward into the application shell.
 */
export default function RootPage() {
  redirect("/dashboard");
}
