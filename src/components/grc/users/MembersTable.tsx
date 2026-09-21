import { Link } from "react-router-dom";
import { Eye, Pencil } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/format";
import type { OrganizationMember } from "@/lib/auth-types";
import { StatusBadge } from "./shared";
import { formatDate, isInactiveStatus } from "./user-management-utils";

interface MembersTableProps {
  members: OrganizationMember[];
  /** Show the System Access switch and row actions. */
  manage?: boolean;
  isAdmin?: boolean;
  /** userId of a member whose status change is in flight. */
  pendingUserId?: string;
  onToggle?: (member: OrganizationMember) => void;
}

export function MembersTable({ members, manage = false, isAdmin = false, pendingUserId, onToggle }: MembersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date Joined</TableHead>
          {manage && isAdmin && <TableHead>System Access</TableHead>}
          {manage && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.membershipId}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-brand-accent/10 text-[11px] font-semibold text-navy">
                    {initials(member.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-navy-deep">{member.fullName}</span>
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{member.username}</TableCell>
            <TableCell>
              <StatusBadge status={member.membershipStatus} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDate(member.joinedAt)}</TableCell>
            {manage && isAdmin && (
              <TableCell>
                <Switch
                  checked={!isInactiveStatus(member.membershipStatus)}
                  disabled={pendingUserId === member.userId}
                  onCheckedChange={() => onToggle?.(member)}
                  aria-label={isInactiveStatus(member.membershipStatus) ? "Activate user" : "Deactivate user"}
                />
              </TableCell>
            )}
            {manage && (
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-brand-accent hover:text-navy">
                    <Link to={`/settings/users/members/${member.membershipId}`}>
                      <Eye /> View
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-brand-accent hover:text-navy">
                    <Link to={`/settings/users/members/${member.membershipId}/edit`}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
