import { useUser } from "@clerk/react";

export function useIsAdmin(): boolean {
  const { user } = useUser();
  if (!user) return false;
  
  // Check if user has admin role in Clerk metadata
  const role = (user.publicMetadata as any)?.role;
  return role === "admin";
}

export function getAdminStatus(user: any): boolean {
  if (!user) return false;
  const role = (user.publicMetadata as any)?.role;
  return role === "admin";
}
