import { toast } from "sonner";

/** Copies text and says so; if the browser refuses, says how to do it by hand. */
export async function copyText(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it by hand.");
  }
}
