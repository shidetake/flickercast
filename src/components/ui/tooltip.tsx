import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  className?: string;
  position?: "left" | "center" | "right";
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className, position = "center" }) => {
  const positionClasses = {
    left: "left-0",
    center: "left-1/2 transform -translate-x-1/2",
    right: "right-0",
  };

  const arrowPositionClasses = {
    left: "left-4",
    center: "left-1/2 transform -translate-x-1/2",
    right: "right-4",
  };

  return (
    <div className={cn("relative inline-block group", className)}>
      {children}
      <div className={cn(
        "absolute bottom-full mb-2 px-4 py-3 text-sm text-white bg-gray-900 rounded-md opacity-0 invisible transition-all duration-200 pointer-events-none group-hover:opacity-100 group-hover:visible z-20 w-96 whitespace-normal",
        positionClasses[position]
      )}>
        {content}
        <div className={cn(
          "absolute top-full border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900",
          arrowPositionClasses[position]
        )}></div>
      </div>
    </div>
  );
};

export { Tooltip };