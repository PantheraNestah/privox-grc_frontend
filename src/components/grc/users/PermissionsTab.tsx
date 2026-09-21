import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/grc/common/states";
import { usePermissionCatalog } from "@/hooks/use-organization";
import { EmptyRow, TableCard, TableSkeleton, errorMessage } from "./shared";
import { FALLBACK_TEXT } from "./user-management-utils";

/** Mounted only while its tab is open, so the catalogue is fetched (and cached) on demand. */
export function PermissionsTab({ isAdmin }: { isAdmin: boolean }) {
  const catalogQuery = usePermissionCatalog();
  const permissions = catalogQuery.data ?? [];

  return (
    <TableCard title="Permissions">
      {catalogQuery.error ? (
        <div className="p-4">
          <ErrorState
            title="Couldn't load permissions"
            message={errorMessage(catalogQuery.error, "Failed to load permissions")}
          />
        </div>
      ) : catalogQuery.isLoading ? (
        <TableSkeleton label="Loading permissions..." />
      ) : permissions.length === 0 ? (
        <EmptyRow>No permissions found.</EmptyRow>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.id || permission.code}>
                <TableCell className="font-medium text-navy-deep">{permission.name || permission.code}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{permission.code}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {permission.description || FALLBACK_TEXT}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-brand-accent hover:text-navy"
                      onClick={() => toast.info("Permission editing is pending backend support")}
                    >
                      <Pencil /> Edit
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Read only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  );
}
