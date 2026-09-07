"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, ChevronsUpDown } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import type { Membership } from "@/server/auth";
import { switchOrganizationAction } from "@/server/actions/auth";

/**
 * Only rendered as an interactive control when the user actually belongs to
 * more than one organization; otherwise it is a static label.
 */
export function OrgSwitcher({
  organizationName,
  memberships,
}: {
  organizationName: string;
  memberships: Membership[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (memberships.length <= 1) {
    return (
      <div className="rounded-md border border-steel-800 bg-steel-950 px-3 py-2">
        <p className="text-[11px] text-steel-400">組織</p>
        <p className="truncate text-sm font-medium text-white" title={organizationName}>
          {organizationName}
        </p>
      </div>
    );
  }

  const handleSwitch = async (organizationId: string) => {
    setPending(true);
    const result = await switchOrganizationAction(organizationId);
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-steel-800 bg-steel-950 px-3 py-2 text-left disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-[11px] text-steel-400">組織</span>
          <span className="block truncate text-sm font-medium text-white">{organizationName}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-steel-400" />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="組織を切り替え"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-steel-700 bg-steel-900 py-1 shadow-xl"
        >
          {memberships.map((membership) => {
            const selected = membership.organizationName === organizationName;
            return (
              <li key={membership.organizationId} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => handleSwitch(membership.organizationId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-steel-200 hover:bg-steel-800"
                >
                  {selected ? (
                    <Check aria-hidden className="size-4 text-amber-400" />
                  ) : (
                    <span aria-hidden className="size-4" />
                  )}
                  <span className="truncate">{membership.organizationName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
