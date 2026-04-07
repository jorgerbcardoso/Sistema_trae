import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Forçar cores do tema escuro sempre
          success: "group-[.toaster]:!bg-green-950 group-[.toaster]:!text-white group-[.toaster]:!border-green-800",
          error: "group-[.toaster]:!bg-red-950 group-[.toaster]:!text-white group-[.toaster]:!border-red-800",
          warning: "group-[.toaster]:!bg-yellow-950 group-[.toaster]:!text-white group-[.toaster]:!border-yellow-800",
          info: "group-[.toaster]:!bg-blue-950 group-[.toaster]:!text-white group-[.toaster]:!border-blue-800",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };