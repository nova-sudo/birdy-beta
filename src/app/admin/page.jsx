import { redirect } from "next/navigation";

// /admin has no page of its own — the rail nav lives in the admin shell and the
// default destination is the agency-owners view.
export default function AdminIndex() {
  redirect("/admin/agencies");
}
