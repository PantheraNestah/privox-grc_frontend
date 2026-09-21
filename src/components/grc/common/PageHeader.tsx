import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  /** Trail after the home crumb. The last entry is the current page. */
  crumbs: Crumb[];
  /** First crumb. Defaults to the platform-admin portal home. */
  home?: { label: string; to: string };
  title: ReactNode;
  description?: ReactNode;
  /** Small badges / chips shown above the title. */
  eyebrow?: ReactNode;
  /** Leading tile, e.g. an icon or initials. */
  leading?: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared page heading for both portals: shadcn breadcrumb,
 * title block and a responsive action group (full-width buttons on phones).
 */
const PLATFORM_HOME = { label: "Platform", to: "/platform/dashboard" };

/** Breadcrumb root for organization-workspace pages: `<PageHeader home={TENANT_HOME} …/>`. */
export const TENANT_HOME = { label: "Home", to: "/dashboard" };

export function PageHeader({
  crumbs,
  home = PLATFORM_HOME,
  title,
  description,
  eyebrow,
  leading,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-4 sm:mb-8">
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:gap-2 sm:text-[13px]">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={home.to} className="inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                {home.label}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  {last || !crumb.to ? (
                    <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {leading}
          <div className="min-w-0">
            {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
            <h1 className="text-2xl font-semibold tracking-tight text-navy-deep sm:text-[1.75rem] sm:leading-9">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
