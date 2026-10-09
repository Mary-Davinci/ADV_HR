import { redirect } from "next/navigation";

/** La gestione candidati vive in /recruiting (ricerca strutturata + schede). */
export default function CandidatesPage() {
  redirect("/recruiting");
}
