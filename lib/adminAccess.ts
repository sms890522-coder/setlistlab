import type { User } from "@supabase/supabase-js";

type AdminMetadata = {
  is_admin?: unknown;
  admin?: unknown;
  role?: unknown;
  roles?: unknown;
};

export function isUserAppAdmin(user: Pick<User, "app_metadata"> | null | undefined) {
  const metadata = (user?.app_metadata ?? {}) as AdminMetadata;
  return (
    metadata.is_admin === true ||
    metadata.admin === true ||
    metadata.role === "admin" ||
    (Array.isArray(metadata.roles) && metadata.roles.includes("admin"))
  );
}
