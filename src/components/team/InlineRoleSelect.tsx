"use client";

import { useTransition } from "react";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { updateUser } from "@/app/dashboard/actions";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

export function InlineRoleSelect({
  userId,
  defaultValue,
  disabled,
}: {
  userId: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <Select
      name="role"
      defaultValue={defaultValue}
      disabled={disabled || pending}
      className="h-8 w-[120px] text-xs"
      onChange={(e) => {
        const value = e.currentTarget.value;
        const fd = new FormData();
        fd.set("role", value);
        start(async () => {
          await updateUser(userId, fd);
          toast(`Role set to ${value.toLowerCase()}`, "success");
        });
      }}
    >
      {ROLE_OPTIONS.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}
