import AdminShell from "@/components/admin/AdminShell";

// Nested layout for every /admin route. The root layout (src/app/layout.jsx)
// bare-renders /admin paths (no main sidebar/header), and this wraps them in
// the standalone admin shell. Auth + admin-role gating is handled upstream by
// ProtectedLayout (pathname.startsWith('/admin')).
export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
