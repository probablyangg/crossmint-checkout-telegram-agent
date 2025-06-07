import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ReactNode } from "react";

interface DropdownOption {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

interface DropdownProps {
  trigger: ReactNode;
  options: DropdownOption[];
}

export function Dropdown({ trigger, options }: DropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Content className="rounded-md bg-white p-1 shadow-md" align="end">
        {options.map((option, index) => (
          <DropdownMenu.Item
            key={index}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 focus-visible:outline-none"
            onClick={option.onClick}
          >
            {option.icon}
            <span>{option.label}</span>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
