import { KeyboardEvent } from "react";

export function useTabKey() {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;

      // Insert tab character at cursor position
      const newValue = target.value.substring(0, start) + "    " + target.value.substring(end);
      target.value = newValue;

      // Move cursor after the inserted tab
      const newPosition = start + 4;
      target.setSelectionRange(newPosition, newPosition);

      // Trigger change event
      const event = new Event("input", { bubbles: true });
      target.dispatchEvent(event);
    }
  };

  return { handleKeyDown };
}
