import type { DefaultSession } from "next-auth";

import type { RoleCode } from "@/domain";

declare module "next-auth" {
  interface User {
    roles?: RoleCode[];
  }

  interface Session {
    user: {
      id: string;
      roles: RoleCode[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    roles?: RoleCode[];
  }
}
