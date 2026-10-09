import { cookies } from "next/headers";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { permissionsOf } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Il layout usa la sessione solo per l'header: la protezione dei dati
  // avviene nel DAL chiamato da ogni pagina/azione (vedi lib/auth/session.ts).
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2 focus:ring-ring"
      >
        Vai al contenuto principale
      </a>
      <AppSidebar permissions={permissionsOf(user)} />
      <SidebarInset className="min-w-0">
        <AppHeader user={user} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
