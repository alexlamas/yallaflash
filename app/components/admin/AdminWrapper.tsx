"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useUserRoles } from "../../hooks/useUserRoles";
import { SubNav, TabConfig } from "../../components/SubNav";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

export function AdminWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { isAdmin, isReviewer, isLoading: isRolesLoading } = useUserRoles();
  const canAccess = isAdmin || isReviewer;

  // Redirect non-admins/reviewers
  useEffect(() => {
    if (!isAuthLoading && !isRolesLoading) {
      if (!session || !canAccess) {
        router.push("/");
      }
    }
  }, [session, canAccess, isAuthLoading, isRolesLoading, router]);

  // Show loading while checking auth
  if (isAuthLoading || isRolesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session || !canAccess) {
    return null;
  }

  // Determine active tab from pathname
  let activeTab = "home";
  if (pathname.includes("/users")) activeTab = "users";
  else if (pathname.includes("/review")) activeTab = "review";
  else if (pathname.includes("/packs")) activeTab = "packs";
  else if (pathname.includes("/images")) activeTab = "images";
  else if (pathname.includes("/songs")) activeTab = "songs";
  else if (pathname.includes("/instagram")) activeTab = "instagram";
  else if (pathname.includes("/design-system")) activeTab = "design-system";
  else if (pathname === "/admin") activeTab = "home";

  const tabs: TabConfig[] = [
    { key: "home", label: "Summary", href: "/admin" },
    ...(isAdmin ? [
      { key: "users", label: "Users", href: "/admin/users" },
    ] : []),
    { key: "review", label: "Review", href: "/admin/review" },
    ...(isAdmin || isReviewer ? [
      { key: "packs", label: "Packs", href: "/admin/packs" },
      { key: "images", label: "Images", href: "/admin/images" },
    ] : []),
    { key: "songs", label: "Songs", href: "/admin/songs" },
    ...(isAdmin ? [
      { key: "instagram", label: "Instagram", href: "/admin/instagram" },
      { key: "design-system", label: "Design system", href: "/admin/design-system" },
    ] : []),
  ];

  const isUsersPage = pathname.includes("/users");

  const usersActions = (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full"
      onClick={() => window.dispatchEvent(new CustomEvent("admin:add-user"))}
    >
      <Plus className="h-4 w-4 mr-1" /> Add user
    </Button>
  );

  return (
    <>
      <SubNav tabs={tabs} activeTab={activeTab} actions={isUsersPage ? usersActions : undefined} />
      <div className="pt-12">
        {children}
      </div>
    </>
  );
}
