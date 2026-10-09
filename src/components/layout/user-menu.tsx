"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/config/labels";
import type { SessionUser } from "@/domain";
import { logoutAction } from "@/features/auth/server/actions";
import { getInitials } from "@/lib/format";

export function UserMenu({ user }: { user: SessionUser }) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Menu utente: ${user.name}`} />
        }
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            <span className="text-xs text-muted-foreground">
              {user.roles.map((role) => ROLE_LABELS[role]).join(", ")}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings aria-hidden="true" />
          Impostazioni
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onClick={() => startTransition(() => logoutAction())}>
          <LogOut aria-hidden="true" />
          {isPending ? "Uscita in corso…" : "Esci"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
