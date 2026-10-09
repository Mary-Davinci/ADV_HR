"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { loginSchema, type LoginInput, type LoginValues } from "../schemas/login-schema";
import { loginAction } from "../server/actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values, callbackUrl);
      // In caso di successo il server esegue il redirect e non si arriva qui.
      if (!result.ok) {
        setServerError(result.error);
        form.setValue("password", "");
        form.setFocus("password");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError && (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Email aziendale</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="nome.cognome@azienda.it"
            className="h-10"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            disabled={isPending}
            {...form.register("email")}
          />
          <FieldError id="email-error" errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-10 pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              disabled={isPending}
              {...form.register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <FieldError id="password-error" errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="h-10 w-full" disabled={isPending}>
        {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <LogIn aria-hidden="true" />}
        {isPending ? "Accesso in corso…" : "Accedi"}
      </Button>
    </form>
  );
}
