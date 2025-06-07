import { Modal } from "../common/Modal";

export function WarningModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} showCloseButton title="Withdraw is not enabled">
      <div className="mt-4 text-center text-sm text-gray-500">
        Withdraw is a production-only feature. Read about how to move to production{" "}
        <a
          className="text-primary"
          href="https://github.com/Crossmint/fintech-starter-app"
          target="_blank"
        >
          here
        </a>
        .
      </div>
    </Modal>
  );
}
