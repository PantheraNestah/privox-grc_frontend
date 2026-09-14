import { Outlet } from "react-router-dom";
import { PlatformTopNav } from "./PlatformTopNav";
import { PlatformMobileTabs, PlatformSidebar } from "./PlatformSidebar";

/**
 * Chrome for the platform-admin portal: same navy top nav + section sidebar
 * shell used by the tenant User Management area.
 */
export function PlatformLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <PlatformTopNav />
      <div className="flex flex-1 min-w-0">
        <PlatformSidebar />
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-9">
          <PlatformMobileTabs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
