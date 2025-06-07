import { cn } from "@/lib/utils";

interface RecipientInputProps {
  recipient: string;
  onChange: (recipient: string) => void;
  error?: string | null;
}

export function RecipientInput({ recipient, onChange, error }: RecipientInputProps) {
  return (
    <>
      <input
        type="email"
        placeholder="Enter recipient email or wallet address"
        className={cn(
          "mt-2 h-12 w-full rounded-md border px-3 py-2 text-base",
          error && "border-red-600"
        )}
        value={recipient}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="mt-1.5 w-full text-red-600">{error}</div>}
    </>
  );
}
