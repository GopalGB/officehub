import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/toast";
import { MobileNav } from "@/components/layout/MobileNav";
import { CommandPalette } from "@/components/layout/CommandPalette";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <ToastProvider>
      <CommandPalette />
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <Sidebar role={session.user.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            name={session.user.name}
            email={session.user.email}
            role={session.user.role}
            mobileNav={<MobileNav role={session.user.role} />}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
