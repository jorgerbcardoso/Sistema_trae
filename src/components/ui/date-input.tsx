import * as React from "react";
import { useTheme } from "../ThemeProvider";
import { cn } from "./utils";

/**
 * ✅ COMPONENTE GARANTIDO PARA INPUTS DE DATA COM ÍCONE BRANCO NO TEMA ESCURO
 * 
 * Este componente FORÇA o ícone de calendário a aparecer branco no tema escuro
 * usando uma combinação de:
 * 1. CSS inline no wrapper
 * 2. Classes específicas
 * 3. Style tag injetado dinamicamente
 */

interface DateInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  type?: "date" | "datetime-local" | "time" | "month" | "week";
}

function DateInput({ className, type = "date", ...props }: DateInputProps) {
  const { theme } = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uniqueId = React.useId();

  // Injetar style específico para este input
  React.useEffect(() => {
    if (theme === 'dark' && inputRef.current) {
      const styleId = `date-input-style-${uniqueId}`;
      
      // Remover style anterior se existir
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }

      // Criar selector único para este input
      const uniqueClass = `date-input-${uniqueId.replace(/:/g, '-')}`;
      inputRef.current.classList.add(uniqueClass);

      // Injetar CSS específico
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        .${uniqueClass}::-webkit-calendar-picker-indicator {
          filter: invert(100%) brightness(120%) !important;
          cursor: pointer !important;
          opacity: 0.9 !important;
        }
        
        .${uniqueClass}::-webkit-calendar-picker-indicator:hover {
          opacity: 1 !important;
          filter: invert(100%) brightness(140%) !important;
        }
      `;
      document.head.appendChild(style);

      // Cleanup
      return () => {
        const styleToRemove = document.getElementById(styleId);
        if (styleToRemove) {
          styleToRemove.remove();
        }
      };
    }
  }, [theme, uniqueId]);

  return (
    <input
      ref={inputRef}
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { DateInput };
