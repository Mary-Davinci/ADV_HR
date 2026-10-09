"use client";

import { BadgeCheck, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { CheckboxField, FieldRow, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { optionsOf, SKILL_CATEGORY_LABELS } from "@/config/labels";
import type { CandidateSkill, SkillCategory } from "@/domain";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { actionResolver } from "@/lib/forms";
import { toFormValue } from "@/lib/zod-helpers";

import { skillSchema } from "../schemas/profile-schemas";
import { removeSkillAction, setSkillAction } from "../server/actions";

type SkillFormInput = z.input<typeof skillSchema>;

const EMPTY: SkillFormInput = {
  skillName: "",
  category: "TECHNICAL",
  level: "",
  yearsExperience: "",
  verified: false,
  notes: "",
};
const CATEGORY_ORDER: SkillCategory[] = ["TECHNICAL", "DIGITAL", "SOFT", "OTHER"];

function LevelDots({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`Livello ${level} su 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < level ? "size-1.5 rounded-full bg-primary" : "size-1.5 rounded-full bg-muted"}
        />
      ))}
    </span>
  );
}

/** Competenze raggruppate per categoria; la stessa skill è normalizzata a catalogo (niente duplicati). */
export function SkillsEditor({
  candidateId,
  skills,
  canEdit,
}: {
  candidateId: string;
  skills: CandidateSkill[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<SkillFormInput>({ resolver: actionResolver(skillSchema), defaultValues: EMPTY });
  const save = useActionMutation(setSkillAction, {
    successMessage: "Competenza salvata",
    onSuccess: () => setOpen(false),
  });
  const remove = useActionMutation(removeSkillAction, { successMessage: "Competenza rimossa" });

  function openEditor(skill: CandidateSkill | null) {
    form.reset(
      skill
        ? {
            skillName: skill.skill.name,
            category: skill.skill.category,
            level: toFormValue(skill.level),
            yearsExperience: toFormValue(skill.yearsExperience),
            verified: skill.verified,
            notes: toFormValue(skill.notes),
          }
        : EMPTY,
    );
    setOpen(true);
  }

  return (
    <Card role="region" aria-labelledby="skills-heading">
      <CardHeader>
        <h3 id="skills-heading" className="text-base leading-snug font-medium">
          Competenze
        </h3>
        {canEdit && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => openEditor(null)}>
              <Plus aria-hidden="true" />
              Aggiungi
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.length === 0 && <p className="text-sm text-muted-foreground">Nessuna competenza registrata.</p>}
        {CATEGORY_ORDER.map((category) => {
          const group = skills.filter((skill) => skill.skill.category === category);
          if (group.length === 0) return null;
          return (
            <div key={category} className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {SKILL_CATEGORY_LABELS[category]}
              </p>
              <ul className="flex flex-wrap gap-2">
                {group.map((skill) => (
                  <li
                    key={skill.skill.id}
                    className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-1 pl-2.5 text-sm"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                      onClick={() => canEdit && openEditor(skill)}
                      disabled={!canEdit}
                      aria-label={canEdit ? `Modifica competenza ${skill.skill.name}` : undefined}
                    >
                      <span className="font-medium">{skill.skill.name}</span>
                      {skill.verified && <BadgeCheck aria-label="Verificata" className="size-3.5 text-primary" />}
                      <LevelDots level={skill.level} />
                      {skill.yearsExperience !== null && (
                        <span className="text-xs text-muted-foreground">
                          {skill.yearsExperience} {skill.yearsExperience === 1 ? "anno" : "anni"}
                        </span>
                      )}
                    </button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Rimuovi competenza ${skill.skill.name}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate({ candidateId, skillId: skill.skill.id })}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Competenza"
        description="Se la competenza esiste già a catalogo viene riutilizzata."
        form={form}
        onSubmit={(values) => save.mutate({ candidateId, values })}
        isPending={save.isPending}
      >
        <FieldRow>
          <TextField<SkillFormInput> name="skillName" label="Competenza" required maxLength={100} />
          <SelectField<SkillFormInput>
            name="category"
            label="Categoria"
            required
            options={optionsOf(SKILL_CATEGORY_LABELS)}
          />
        </FieldRow>
        <FieldRow>
          <SelectField<SkillFormInput>
            name="level"
            label="Livello"
            options={[1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: `${level} / 5` }))}
          />
          <TextField<SkillFormInput> name="yearsExperience" label="Anni di esperienza" type="number" />
        </FieldRow>
        <CheckboxField<SkillFormInput> name="verified" label="Verificata dal recruiter" />
        <TextareaField<SkillFormInput> name="notes" label="Note" rows={2} maxLength={500} />
      </FormDialog>
    </Card>
  );
}
