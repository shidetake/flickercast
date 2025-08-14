import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className }) => {
  return (
    <div className={cn("relative inline-block group", className)}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 text-sm text-white bg-gray-900 rounded-md opacity-0 invisible transition-all duration-200 pointer-events-none group-hover:opacity-100 group-hover:visible z-20 w-96 whitespace-normal">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export { Tooltip };