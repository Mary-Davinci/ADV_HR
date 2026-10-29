"use client";

import { Building2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { optionsOf, SELECTION_STATUS_LABELS } from "@/config/labels";
import type { Company, RecruitmentSelection } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { toFormValue } from "@/lib/zod-helpers";

import { companySchema, selectionSchema } from "../schemas";
import {
  createCompanyAction,
  createSelectionAction,
  updateCompanyAction,
  updateSelectionAction,
} from "../server/actions";

type CompanyInput = z.input<typeof companySchema>;
type SelectionInput = z.input<typeof selectionSchema>;

const EMPTY_COMPANY: CompanyInput = {
  name: "",
  vatNumber: "",
  fiscalCode: "",
  sector: "",
  city: "",
  province: "",
  region: "",
  email: "",
  phone: "",
  notes: "",
};

function CompanyFields() {
  return (
    <>
      <TextField<CompanyInput> name="name" label="Ragione sociale" required maxLength={200} />
      <FieldRow>
        <TextField<CompanyInput> name="vatNumber" label="Partita IVA" maxLength={13} />
        <TextField<CompanyInput> name="fiscalCode" label="Codice fiscale" maxLength={16} />
      </FieldRow>
      <TextField<CompanyInput> name="sector" label="Settore" maxLength={100} />
      <FieldRow columns={3}>
        <TextField<CompanyInput> name="city" label="Città" maxLength={100} />
        <TextField<CompanyInput> name="province" label="Provincia" maxLength={2} />
        <TextField<CompanyInput> name="region" label="Regione" maxLength={60} />
      </FieldRow>
      <FieldRow>
        <TextField<CompanyInput> name="email" label="Email" type="email" maxLength={254} />
        <TextField<CompanyInput> name="phone" label="Telefono" type="tel" maxLength={40} />
      </FieldRow>
      <TextareaField<CompanyInput> name="notes" label="Note" rows={3} maxLength={2000} />
    </>
  );
}

export function CompanyFormButton({ company }: { company?: Company }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: CompanyInput = company
    ? {
        name: company.name,
        vatNumber: toFormValue(company.vatNumber),
        fiscalCode: toFormValue(company.fiscalCode),
        sector: toFormValue(company.sector),
        city: toFormValue(company.city),
        province: toFormValue(company.province),
        region: toFormValue(company.region),
        email: toFormValue(company.email),
        phone: toFormValue(company.phone),
        notes: toFormValue(company.notes),
      }
    : EMPTY_COMPANY;
  const form = useForm<CompanyInput>({ resolver: actionResolver(companySchema), defaultValues: initial });
  const create = useActionMutation(createCompanyAction, {
    successMessage: "Azienda creata",
    onSuccess: ({ id }) => {
      setOpen(false);
      router.push(`/companies/${id}`);
    },
  });
  const update = useActionMutation(updateCompanyAction, {
    successMessage: "Azienda aggiornata",
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button
        variant={company ? "outline" : "default"}
        onClick={() => {
          form.reset(initial);
          setOpen(true);
        }}
      >
        {company ? <Pencil aria-hidden="true" /> : <Building2 aria-hidden="true" />}
        {company ? "Modifica" : "Nuova azienda"}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={company ? "Modifica azienda" : "Nuova azienda"}
        form={form}
        onSubmit={(values) => (company ? update.mutate({ companyId: company.id, values }) : create.mutate(values))}
        isPending={create.isPending || update.isPending}
        size="lg"
      >
        <CompanyFields />
      </FormDialog>
    </>
  );
}

function toDateInput(value: Date | null): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Crea (con scelta azienda) o modifica una selezione aziendale. */
export function SelectionFormButton({
  selection,
  companyId,
  companies,
  label,
}: {
  selection?: RecruitmentSelection;
  companyId?: string;
  companies?: Array<{ id: string; name: string }>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: SelectionInput = selection
    ? {
        companyId: selection.companyId,
        title: selection.title,
        status: selection.status,
        openedAt: toDateInput(selection.openedAt),
        closedAt: toDateInput(selection.closedAt),
      }
    : { companyId: companyId ?? companies?.[0]?.id ?? "", title: "", status: "OPEN", openedAt: "", closedAt: "" };
  const form = useForm<SelectionInput>({ resolver: actionResolver(selectionSchema), defaultValues: initial });
  const create = useActionMutation(createSelectionAction, {
    successMessage: "Selezione creata",
    onSuccess: ({ id }) => {
      setOpen(false);
      const values = form.getValues();
      router.push(`/companies/${values.companyId}/selections/${id}?tab=compatible`);
    },
  });
  const update = useActionMutation(updateSelectionAction, {
    successMessage: "Selezione aggiornata",
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Button
        variant={selection ? "outline" : "default"}
        onClick={() => {
          form.reset(initial);
          setOpen(true);
        }}
      >
        {selection ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {label ?? (selection ? "Modifica" : "Nuova selezione")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={selection ? "Modifica selezione" : "Nuova selezione"}
        description={selection ? undefined : "Dopo la creazione potrai compilare la job description."}
        form={form}
        onSubmit={(values) =>
          selection ? update.mutate({ selectionId: selection.id, values }) : create.mutate(values)
        }
        isPending={create.isPending || update.isPending}
      >
        {!selection && companies && !companyId && (
          <SelectField<SelectionInput>
            name="companyId"
            label="Azienda"
            required
            options={companies.map((company) => ({ value: company.id, label: company.name }))}
          />
        )}
        <TextField<SelectionInput>
          name="title"
          label="Titolo della posizione"
          description="La figura cercata (es. Commerciale, Elettricista): serve a proporre i candidati compatibili."
          required
          maxLength={200}
        />
        <SelectField<SelectionInput>
          name="status"
          label="Stato"
          required
          options={optionsOf(SELECTION_STATUS_LABELS)}
        />
        <FieldRow>
          <TextField<SelectionInput>
            name="openedAt"
            label="Data apertura"
            type="date"
            description="Vuota = oggi, se aperta"
          />
          <TextField<SelectionInput> name="closedAt" label="Data chiusura" type="date" />
        </FieldRow>
      </FormDialog>
    </>
  );
}
