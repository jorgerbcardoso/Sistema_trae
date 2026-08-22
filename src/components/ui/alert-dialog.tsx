"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "./utils";
import { buttonVariants } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";

type ConfirmDialogOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type PromptDialogOptions = {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
};

function useConfirmDialog() {
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description?: React.ReactNode;
    confirmText: string;
    cancelText: string;
    variant: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: undefined,
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "default",
  });

  const finalize = React.useCallback((value: boolean) => {
    const r = resolverRef.current;
    if (r) {
      resolverRef.current = null;
      r(value);
    }
    setState((s) => (s.open ? { ...s, open: false } : s));
  }, []);

  const confirm = React.useCallback((opts: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        title: opts.title,
        description: opts.description,
        confirmText: opts.confirmText ?? "Confirmar",
        cancelText: opts.cancelText ?? "Cancelar",
        variant: opts.variant ?? "default",
      });
    });
  }, []);

  const dialog = (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) finalize(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description ? (
            <AlertDialogDescription>
              <div className="whitespace-pre-line">{state.description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finalize(false)}>{state.cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => finalize(true)}
            className={state.variant === "destructive" ? "bg-red-600 hover:bg-red-700 text-white" : undefined}
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}

function usePromptDialog() {
  const resolverRef = React.useRef<((value: string | null) => void) | null>(null);
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description?: React.ReactNode;
    label: string;
    placeholder: string;
    confirmText: string;
    cancelText: string;
  }>({
    open: false,
    title: "",
    description: undefined,
    label: "Valor",
    placeholder: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
  });
  const [value, setValue] = React.useState("");

  const finalize = React.useCallback((v: string | null) => {
    const r = resolverRef.current;
    if (r) {
      resolverRef.current = null;
      r(v);
    }
    setState((s) => (s.open ? { ...s, open: false } : s));
  }, []);

  const prompt = React.useCallback((opts: PromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setValue(opts.initialValue ?? "");
      setState({
        open: true,
        title: opts.title,
        description: opts.description,
        label: opts.label ?? "Valor",
        placeholder: opts.placeholder ?? "",
        confirmText: opts.confirmText ?? "Confirmar",
        cancelText: opts.cancelText ?? "Cancelar",
      });
    });
  }, []);

  const canConfirm = value.trim().length > 0;

  const dialog = (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open) finalize(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description ? <DialogDescription>{state.description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-2">
          <Label>{state.label}</Label>
          <Input
            autoFocus
            value={value}
            placeholder={state.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) finalize(value); if (e.key === "Escape") finalize(null); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => finalize(null)}>{state.cancelText}</Button>
          <Button onClick={() => finalize(value)} disabled={!canConfirm}>{state.confirmText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { prompt, dialog };
}

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  useConfirmDialog,
  usePromptDialog,
};

export type { ConfirmDialogOptions, PromptDialogOptions };
