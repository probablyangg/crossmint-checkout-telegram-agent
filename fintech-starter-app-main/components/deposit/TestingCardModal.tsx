import Image from "next/image";
import { CopyWrapper } from "../common/CopyWrapper";

export function TestingCardModal() {
  return (
    <div className="fixed top-6 z-20 w-[calc(100%-32px)] space-y-3 rounded-3xl bg-white p-5 shadow-md lg:right-6 lg:w-[419px]">
      <div className="flex items-center gap-5 text-lg font-medium">
        <Image src="/credit-card-outline.svg" alt="Credit Card" width={24} height={24} />
        <span>Test payments</span>
      </div>
      <p className="hidden text-gray-500 lg:block">
        Use the following test card to complete your payment
      </p>
      <div>
        <div className="w-full">
          <div className="border-console-border flex items-center justify-between gap-2 rounded-md border py-1 pl-3 pr-1 shadow-sm">
            <span className="truncate text-sm">4242 4242 4242 4242</span>
            <CopyWrapper
              toCopy="4242 4242 4242 4242"
              className="border-console-border rounded-md border px-4 py-2 text-xs font-medium transition"
              iconPosition="right"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
