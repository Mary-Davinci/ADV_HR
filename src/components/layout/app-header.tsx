"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getBreadcrumbs } from "@/config/navigation";
import type { SessionUser } from "@/domain";

import { GlobalSearch } from "./global-search";
import { NotificationsButton } from "./notifications-button";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {crumb.href ? (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1.5">
        <GlobalSearch />
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
