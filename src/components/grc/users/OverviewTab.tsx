import { type ReactNode } from "react";
import { Layers, UserCheck, Users, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/grc/common/states";
import { useOrganizationGroups, useOrganizationMembers } from "@/hooks/use-organization";
import { MembersTable } from "./MembersTable";
import { EmptyRow, TableCard, TableSkeleton, errorMessage } from "./shared";
import { isInactiveStatus } from "./user-management-utils";

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-12" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tracking-tight text-navy-deep">{value}</p>
        )}
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
        {icon}
      </span>
    </Card>
  );
}

export function OverviewTab({ orgId }: { orgId: string }) {
  const membersQuery = useOrganizationMembers(orgId || undefined);
  const groupsQuery = useOrganizationGroups(orgId || undefined);
  const members = membersQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const inactive = members.filter((m) => isInactiveStatus(m.membershipStatus)).length;
  const error = membersQuery.error ?? groupsQuery.error;

  return (
    <div className="space-y-6">
      {error && (
        <ErrorState
          title="Couldn't load user management data"
          message={errorMessage(error, "Failed to load user management data")}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total Users" value={members.length} loading={membersQuery.isLoading} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Total Groups" value={groups.length} loading={groupsQuery.isLoading} />
        <StatCard
          icon={<UserCheck className="h-4 w-4" />}
          label="Active Users"
          value={members.length - inactive}
          loading={membersQuery.isLoading}
        />
        <StatCard icon={<UserX className="h-4 w-4" />} label="Inactive Users" value={inactive} loading={membersQuery.isLoading} />
      </div>

      <TableCard title="Users">
        {membersQuery.isLoading ? (
          <TableSkeleton label="Loading members..." />
        ) : members.length === 0 ? (
          <EmptyRow>No members found.</EmptyRow>
        ) : (
          <MembersTable members={members} />
        )}
      </TableCard>
    </div>
  );
}
