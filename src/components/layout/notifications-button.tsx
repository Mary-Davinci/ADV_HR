"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotificationsAction, markNotificationsReadAction } from "@/features/notifications/server/actions";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["notifications"] as const;
/** Ogni quanto ricontrollare le nuove notifiche (anche a finestra in primo piano). */
const REFRESH_MS = 60_000;

async function loadNotifications() {
  const result = await getNotificationsAction();
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Campanella con le notifiche personali (oggi: candidature arrivate dal sito). */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadNotifications,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: async (ids?: string[]) => {
      const result = await markNotificationsReadAction({ ids });
      if (!result.ok) throw new Error(result.error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];
  const label = unread > 0 ? `Notifiche: ${unread} da leggere` : "Notifiche";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={label} className="relative" />}>
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-medium">Notifiche</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              <CheckCheck aria-hidden="true" />
              Segna tutte come lette
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <BellOff aria-hidden="true" className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Nessuna notifica</p>
            <p className="text-xs text-muted-foreground">Qui compariranno le candidature ricevute dal sito.</p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto overscroll-contain py-1">
            {items.map((item) => {
              const isUnread = item.readAt === null;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (isUnread) markRead.mutate([item.id]);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
                      isUnread && "bg-primary/5",
                    )}
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserPlus aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", isUnread ? "font-semibold" : "font-medium")}>
                        {item.title}
                        {isUnread && <span className="sr-only"> (da leggere)</span>}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">{item.body}</span>
                      <span className="block text-xs text-muted-foreground" title={formatDateTime(item.createdAt)}>
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </span>
                    {isUnread && <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
