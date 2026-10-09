"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { MAIN_NAVIGATION, SECONDARY_NAVIGATION, isNavItemActive, type NavItem } from "@/config/navigation";
import type { Permission } from "@/lib/auth/permissions";

import { AppLogo } from "./app-logo";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={item.title}
        render={
          <Link
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              if (isMobile) setOpenMobile(false);
            }}
          />
        }
      >
        <Icon aria-hidden="true" />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Le voci sono filtrate per permesso; le pagine verificano comunque l'accesso lato server. */
export function AppSidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  const allowed = (item: NavItem) => permissions.includes(item.permission);
  const groups = MAIN_NAVIGATION.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <Sidebar collapsible="icon" aria-label="Navigazione principale">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link
          href="/dashboard"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="ADV_HR – vai alla dashboard"
        >
          <AppLogo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {SECONDARY_NAVIGATION.filter(allowed).map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
