import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  subtitle: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  Icon: React.ElementType;
  iconClassName?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  subtitle,
  value,
  change,
  changeType = "neutral",
  Icon,
  iconClassName
}) => {
  return (
    <Card className="relative p-5 bg-slate-900/40 border-slate-800/60 rounded-[24px] overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-xl bg-slate-800/60", iconClassName)}>
              <Icon className="h-5 w-5" />
            </div>
            {change && (
              <span className={cn(
                "text-[11px] font-bold px-1.5 py-0.5 rounded-md",
                changeType === "positive" ? "bg-emerald-500/10 text-emerald-500" :
                changeType === "negative" ? "bg-rose-500/10 text-rose-500" :
                "bg-muted0/10 text-muted-foreground"
              )}>
                {change}
              </span>
            )}
          </div>
          
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-[10px] text-card-foreground uppercase tracking-tight">{subtitle}</p>
          </div>
          
          <div className="text-3xl font-bold text-slate-100 mt-1">
            {value}
          </div>
        </div>
      </div>
      
      {/* Subtle background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Icon className="h-24 w-24" />
      </div>
    </Card>
  );
};
