"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Building2,
  Eye,
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { Membership } from "@/server/auth";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { signOutAction } from "@/server/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/estimates", label: "見積", icon: FileText },
  { href: "/projects", label: "工事案件", icon: HardHat },
  { href: "/customers", label: "顧客", icon: Users },
  { href: "/settings/company", label: "会社設定", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="メインナビゲーション" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-amber-accent text-white"
                : "text-steel-300 hover:bg-steel-800 hover:text-white",
            )}
          >
            <Icon aria-hidden className="size-[18px] shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  organizationName,
  memberships,
  userLabel,
  readOnly,
  onNavigate,
}: {
  organizationName: string;
  memberships: Membership[];
  userLabel: string;
  readOnly: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-accent text-white"
        >
          <Building2 className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">見積管理</p>
          <p className="truncate text-[11px] text-steel-400">Construction Estimate</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <OrgSwitcher organizationName={organizationName} memberships={memberships} />
        {readOnly ? (
          <p className="mt-2 flex items-center gap-1.5 rounded-md bg-steel-800 px-2.5 py-1.5 text-[11px] font-medium text-steel-300">
            <Eye aria-hidden className="size-3.5 shrink-0" />
            デモ閲覧モード（編集不可）
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <NavLinks onNavigate={onNavigate} />
      </div>

      <div className="border-t border-steel-800 p-3">
        <p className="truncate px-3 pb-2 text-xs text-steel-400" title={userLabel}>
          {userLabel}
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-steel-300 transition-colors hover:bg-steel-800 hover:text-white"
          >
            <LogOut aria-hidden className="size-[18px]" />
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  organizationName,
  memberships,
  userLabel,
  readOnly,
  children,
}: {
  organizationName: string;
  memberships: Membership[];
  userLabel: string;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [renderedPath, setRenderedPath] = React.useState(pathname);

  // Close the drawer whenever navigation happens (including browser back).
  // Adjusting state during render is React's documented alternative to an
  // effect for "reset state when a prop changes".
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 bg-[var(--surface-shell)] lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent
            organizationName={organizationName}
            memberships={memberships}
            userLabel={userLabel}
            readOnly={readOnly}
          />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            className="absolute inset-0 bg-steel-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--surface-shell)] shadow-2xl">
            <SidebarContent
              organizationName={organizationName}
              memberships={memberships}
              userLabel={userLabel}
              readOnly={readOnly}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-steel-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "メニューを閉じる" : "メニューを開く"}
            className="flex size-10 items-center justify-center rounded-md border border-steel-300 text-steel-700"
          >
            {mobileOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
          <p className="min-w-0 truncate text-sm font-semibold text-ink">{organizationName}</p>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
            {readOnly ? <ReadOnlyNotice className="mb-6" /> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
