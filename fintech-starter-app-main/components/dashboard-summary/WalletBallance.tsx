import { useBalance } from "../../hooks/useBalance";

export function WalletBalance() {
  const { displayableBalance } = useBalance();
  return (
    <div className="mb-6 flex w-full flex-col items-start md:mb-0 md:w-auto">
      <span className="mb-1 text-base text-gray-500">Your balance</span>
      <span className="text-4xl font-semibold">${displayableBalance}</span>
    </div>
  );
}
