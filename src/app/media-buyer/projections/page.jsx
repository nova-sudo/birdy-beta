import { redirect } from "next/navigation";

// Projections is off Media Buyer's menu for now. Old links land on its Bird's Eye.
export default function MediaBuyerProjectionsPage() {
  redirect("/media-buyer");
}
