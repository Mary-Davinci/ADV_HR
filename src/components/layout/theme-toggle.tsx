"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const label = "Cambia tema chiaro/scuro";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          />
        }
      >
        {/* Icone gestite via CSS per evitare mismatch di idratazione. */}
        <Sun aria-hidden="true" className="dark:hidden" />
        <Moon aria-hidden="true" className="hidden dark:block" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
