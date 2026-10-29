import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PublicJobRequest } from "@/features/job-requests/components/public-job-request";
import { publicJobRequests } from "@/lib/server/services";
import { InvalidLinkError } from "@/services/job-requests/public-job-request-service";

export const metadata: Metadata = {
  title: "Modulo Job Description",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PublicJobRequestPage({ params }: PageProps<"/modulo/[token]">) {
  const { token } = await params;
  const view = await publicJobRequests()
    .view(token)
    .catch((error: unknown) => {
      if (error instanceof InvalidLinkError) return null;
      throw error;
    });

  if (!view) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Link non valido o scaduto"
        description="Il link potrebbe essere scaduto o già utilizzato per aprire la selezione. Contatta Accademia Da Vinci per riceverne uno nuovo."
      />
    );
  }
  return <PublicJobRequest token={token} view={view} />;
}
