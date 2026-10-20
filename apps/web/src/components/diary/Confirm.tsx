import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** `const [dialog, confirm] = useConfirm(); if (await confirm({...})) ...` */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => undefined);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current(value);
    setOptions(null);
  };

  const dialog = (
    <Dialog open={Boolean(options)} onClose={() => close(false)} title={options?.title ?? ''}>
      {options?.body && <div className="italic text-ink-soft">{options.body}</div>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => close(false)}>
          Cancel
        </Button>
        <Button variant={options?.danger ? 'wax' : 'ink'} onClick={() => close(true)}>
          {options?.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );

  return [dialog, confirm];
}
