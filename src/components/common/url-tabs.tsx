"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface UrlTab {
  value: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

/**
 * Tab accessibili (Base UI: frecce da tastiera, ruoli ARIA) con la tab attiva
 * riflessa in `?tab=` per link diretti e refresh. Il contenuto è renderizzato
 * lato server e passato come ReactNode.
 */
export function UrlTabs({ tabs, defaultValue, label }: { tabs: UrlTab[]; defaultValue?: string; label: string }) {
  const initial = tabs.some((tab) => tab.value === defaultValue) ? defaultValue : tabs[0]?.value;
  const [value, setValue] = useState(initial);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = String(next);
        setValue(tab);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url);
      }}
      className="gap-4"
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList variant="line" aria-label={label} className="h-9 w-max justify-start border-b pb-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="h-9 flex-none px-3">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
