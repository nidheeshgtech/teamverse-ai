import { notFound } from "next/navigation";

// Unknown paths under the locale segment render the localized not-found page.
export default function CatchAll() {
  notFound();
}
