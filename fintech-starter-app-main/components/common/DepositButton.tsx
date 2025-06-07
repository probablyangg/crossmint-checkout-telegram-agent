import Image from "next/image";

export function DepositButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="hover:bg-primary-hover bg-primary text-primary-foreground flex h-12 flex-grow items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition md:w-40"
      onClick={onClick}
    >
      <Image src="/plus-icon-white.svg" alt="Add" width={24} height={24} /> Deposit
    </button>
  );
}
