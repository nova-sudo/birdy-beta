import { notFound } from "next/navigation";

export const metadata = { title: "Birdy kit" };

/**
 * The redesign's component preview. Development server only until the
 * redesign is done: a production build answers "not found".
 */
export default function KitLayout({ children }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="min-h-screen bg-by-canvas font-by-body text-by-body text-by-text antialiased">
      {children}
    </div>
  );
}
