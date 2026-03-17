import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "./utils";

/**
 * ✅ SOLUÇÃO DEFINITIVA: Input de data com ícone CUSTOMIZADO
 * Esconde o ícone nativo e usa um ícone do lucide-react que SEMPRE fica visível
 */

interface CalendarInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  type?: "date" | "datetime-local" | "time" | "month" | "week";
}

function CalendarInput({ className, type = "date", ...props }: CalendarInputProps) {
  return (
    <div className="relative w-full">
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 pr-9 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          // ✅ ESCONDER O ÍCONE NATIVO DO NAVEGADOR
          "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className,
        )}
        {...props}
      />
      {/* ✅ ÍCONE CUSTOMIZADO QUE SEMPRE FICA VISÍVEL */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <Calendar className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
      </div>
    </div>
  );
}

export { CalendarInput };
