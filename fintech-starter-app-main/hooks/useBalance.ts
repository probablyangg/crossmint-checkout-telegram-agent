import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@crossmint/client-sdk-react-ui";

export function useBalance() {
  const { wallet } = useWallet();
  const {
    data: balances = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["balances", wallet?.address],
    queryFn: async () => (await wallet?.balances(["usdc"])) ?? [],
  });

  const usdcBalance = balances?.find((t) => t.token === "usdc")?.amount || "0";
  return {
    balances,
    displayableBalance: parseFloat(usdcBalance).toFixed(2),
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    isLoading,
    refetch,
  };
}
