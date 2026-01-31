import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const percentage = (current / max) * 100;
  
  const getColorClass = () => {
    if (current >= max) return "text-destructive";
    if (percentage >= 97.5) return "text-destructive"; // 3900+
    if (percentage >= 87.5) return "text-yellow-600 dark:text-yellow-500"; // 3500+
    return "text-muted-foreground";
  };

  const getMessage = () => {
    if (current >= max) return "Message too long";
    if (percentage >= 97.5) return "Almost at limit";
    if (percentage >= 87.5) return "Approaching limit";
    return null;
  };

  const message = getMessage();

  return (
    <div className={cn("flex items-center justify-between text-xs", className)}>
      <span className={getColorClass()}>
        {current.toLocaleString()} / {max.toLocaleString()}
      </span>
      {message && (
        <span className={cn("font-medium", getColorClass())}>
          {message}
        </span>
      )}
    </div>
  );
}
