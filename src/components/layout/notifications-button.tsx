"use client";

import { Bell, BellOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Placeholder: il centro notifiche verrà collegato quando esisteranno eventi reali. */
export function NotificationsButton() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Notifiche" />}>
        <Bell aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <BellOff aria-hidden="true" className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Nessuna notifica</p>
          <p className="text-xs text-muted-foreground">Qui compariranno promemoria su colloqui e candidature.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
