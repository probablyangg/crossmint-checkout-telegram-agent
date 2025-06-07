"use client";

import { useAuth } from "@crossmint/client-sdk-react-ui";

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      className="w-full rounded-md border bg-gray-50 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100"
      onClick={logout}
    >
      Log out
    </button>
  );
}
