import Image from "next/image";
import { WalletBalance } from "./WalletBallance";
import { DepositButton } from "../common/DepositButton";
import { Container } from "../common/Container";
import { ArrowsRightLeftIcon, WalletIcon } from "@heroicons/react/24/outline";
import { Dropdown } from "../common/Dropdown";
import { useState } from "react";
import { WalletDetails } from "./WalletDetails";
import { useWallet, useAuth } from "@crossmint/client-sdk-react-ui";
import { WarningModal } from "./WarningModal";

interface DashboardSummaryProps {
  onDepositClick: () => void;
  onSendClick: () => void;
}

export function DashboardSummary({ onDepositClick, onSendClick }: DashboardSummaryProps) {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const { wallet } = useWallet();
  const { user } = useAuth();
  const [openWarningModal, setOpenWarningModal] = useState(false);
  const dropdownOptions = [
    {
      icon: <ArrowsRightLeftIcon className="h-4 w-4" />,
      label: "Withdraw",
      onClick: () => {
        if (process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY?.includes("staging")) {
          setOpenWarningModal(true);
        } else {
          window.location.href = `https://pay.coinbase.com/v3/sell/input?${new URLSearchParams({
            appId: process.env.NEXT_PUBLIC_COINBASE_APP_ID!,
            addresses: JSON.stringify({ [wallet?.address || ""]: [wallet?.chain || ""] }),
            redirectUrl: window.location.origin,
            partnerUserId: user?.id!,
            assets: JSON.stringify(["USDC"]),
          })}`;
        }
      },
    },
    {
      icon: <WalletIcon className="h-4 w-4" />,
      label: "Wallet Details",
      onClick: () => {
        setShowWalletDetails(true);
      },
    },
  ];

  const dropdownTrigger = (
    <button className="bg-secondary hover:bg-secondary/80 rounded-full p-2.5">
      <Image src="/dots-vertical.svg" alt="Settings" width={24} height={24} />
    </button>
  );

  return (
    <Container className="flex w-full max-w-5xl flex-col items-center justify-between md:flex-row md:items-stretch">
      <WalletBalance />
      <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
        <DepositButton onClick={onDepositClick} />
        <button
          type="button"
          className="bg-secondary hover:bg-secondary/80 text-secondary-foreground flex h-12 flex-grow items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition md:w-40"
          onClick={onSendClick}
        >
          <Image src="/arrow-up-right-icon-white.svg" alt="Add" width={24} height={24} /> Send
        </button>
        <Dropdown trigger={dropdownTrigger} options={dropdownOptions} />
      </div>
      <WalletDetails onClose={() => setShowWalletDetails(false)} open={showWalletDetails} />
      <WarningModal open={openWarningModal} onClose={() => setOpenWarningModal(false)} />
    </Container>
  );
}
