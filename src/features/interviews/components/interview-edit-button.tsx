"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Interview } from "@/domain";
import { InterviewDialog } from "@/features/recruiting/components/application-dialogs";

/** Modifica di un colloquio (data, stato, esito organizzativo). */
export function InterviewEditButton({
  interview,
  candidateName,
  recruiters,
  label = "Modifica",
}: {
  interview: Interview;
  candidateName: string;
  recruiters: Array<{ id: string; displayName: string }>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`${label} colloquio con ${candidateName}`}
      >
        <Pencil aria-hidden="true" />
        {label}
      </Button>
      <InterviewDialog
        open={open}
        onOpenChange={setOpen}
        applicationId={interview.applicationId}
        candidateName={candidateName}
        interview={interview}
        recruiters={recruiters}
      />
    </>
  );
}
