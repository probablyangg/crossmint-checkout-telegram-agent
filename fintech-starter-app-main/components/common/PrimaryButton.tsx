export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="bg-primary hover:bg-primary-hover text-primary-foreground mt-8 w-full rounded-full py-3 text-lg font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
