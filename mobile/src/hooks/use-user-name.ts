// A student's name, looked up by id (cached in lib/user-names.ts). Empty until it arrives.
import { useEffect, useState } from "react";

import { getUserName } from "@/lib/user-names";

export function useUserName(id: string): string {
  const [name, setName] = useState("");
  useEffect(() => {
    let current = true;
    getUserName(id).then((found) => current && setName(found));
    return () => {
      current = false;
    };
  }, [id]);
  return name;
}
