import { useEffect, useState } from "react";
import { getActiveUser, type AppUser } from "@/data/userStore";

export function useActiveUser(): AppUser {
  const [user, setUser] = useState<AppUser>(() => getActiveUser());

  useEffect(() => {
    const refresh = () => setUser(getActiveUser());
    window.addEventListener("rsolve:active-user-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rsolve:active-user-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return user;
}
