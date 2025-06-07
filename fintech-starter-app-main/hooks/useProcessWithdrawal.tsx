import { useEffect } from "react";
import { Chain, Wallet } from "@crossmint/client-sdk-react-ui";
import { getTransactions } from "@/server-actions/getTransactions";
import { useBalance } from "./useBalance";
import { useActivityFeed } from "./useActivityFeed";

const getProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    return JSON.parse(processedTransactions)[transactionId] || false;
  }
  return false;
};

const setProccesedTransactions = (transactionId: string) => {
  const processedTransactions = localStorage.getItem("processedTransactions");
  if (processedTransactions) {
    JSON.parse(processedTransactions)[transactionId] = true;
  } else {
    localStorage.setItem("processedTransactions", JSON.stringify({ [transactionId]: true }));
  }
};

export function useProcessWithdrawal(userId?: string, wallet?: Wallet<Chain>) {
  const { refetch: refetchBalance } = useBalance();
  const { refetch: refetchActivityFeed } = useActivityFeed();
  useEffect(() => {
    (async () => {
      if (userId && wallet) {
        const transactions = await getTransactions(userId);
        const transaction = transactions[0];
        if (
          transaction?.status === "TRANSACTION_STATUS_STARTED" &&
          !getProccesedTransactions(transaction?.transaction_id)
        ) {
          setProccesedTransactions(transaction.transaction_id);
          await wallet.send(transaction.to_address, "usdc", transaction.sell_amount.value);
          refetchBalance();
          refetchActivityFeed();
        }
      }
    })();
  }, [userId, wallet]);
}
