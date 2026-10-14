import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate, fromISO, toISO } from "@/lib/format";

export function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal sm:w-44">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label && <span className="mr-1 text-muted-foreground">{label}</span>}
          {value ? fmtDate(value) : "DD/MM/AAAA"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={value ? fromISO(value) : undefined}
          defaultMonth={value ? fromISO(value) : undefined}
          onSelect={(d) => d && onChange(toISO(d))}
        />
      </PopoverContent>
    </Popover>
  );
}
