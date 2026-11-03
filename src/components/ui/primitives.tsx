"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
        brand: "bg-brand text-brand-foreground shadow-sm hover:brightness-105",
        outline: "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        soft: "bg-secondary text-secondary-foreground hover:brightness-95",
      },
      size: { default: "h-9 px-4", sm: "h-8 px-3 text-xs", lg: "h-11 px-6", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...p }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...p} />;
});
Button.displayName = "Button";

/* ---------- Card ---------- */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]", className)} {...p} />;
}
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-start justify-between gap-3 p-5 pb-3", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pt-2", className)} {...p} />;

/* ---------- Badge ---------- */
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      primary: "bg-secondary text-secondary-foreground",
      brand: "bg-brand/15 text-brand",
      success: "bg-success/15 text-success",
      warning: "bg-warning/15 text-warning",
      danger: "bg-destructive/15 text-destructive",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

/* ---------- Form controls ---------- */
const control = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(control, "h-9", className)} {...p} />);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(control, "min-h-20", className)} {...p} />);
Textarea.displayName = "Textarea";
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(control, "h-9 pr-8", className)} {...p} />);
Select.displayName = "Select";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

/* ---------- Dialog / Sheet ---------- */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, title, description, side, ...p }: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; side?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "liquid fixed z-50 flex flex-col gap-4 overflow-y-auto bg-card p-6 text-card-foreground outline-none",
          side
            ? "inset-y-0 right-0 w-full max-w-lg rounded-l-2xl animate-in slide-in-from-right duration-300"
            : "left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-in fade-in zoom-in-95 duration-200",
          className,
        )}
        {...p}
      >
        <div className="pr-8">
          <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className={description ? "mt-1 text-sm text-muted-foreground" : "sr-only"}>{description ?? title}</DialogPrimitive.Description>
        </div>
        {children}
        <DialogPrimitive.Close aria-label="Cerrar" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Confirmación para acciones importantes. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmar", danger, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="max-w-md">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow-sm)]", className)} {...p} />
);
export const TabsContent = TabsPrimitive.Content;

/* ---------- Switch / Progress / Skeleton ---------- */
export function Switch({ className, ...p }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root className={cn("h-5 w-9 shrink-0 rounded-full bg-input transition data-[state=checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)} {...p}>
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "brand" | "success" }) {
  const color = { primary: "bg-primary", brand: "bg-brand", success: "bg-success" }[tone];
  return (
    <ProgressPrimitive.Root value={value} className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <ProgressPrimitive.Indicator className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </ProgressPrimitive.Root>
  );
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton", className)} />;
