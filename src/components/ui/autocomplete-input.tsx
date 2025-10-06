'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface StockSymbol {
  symbol: string;
  name: string;
}

export interface AutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  symbols?: StockSymbol[];
}

const AutocompleteInput = React.forwardRef<HTMLInputElement, AutocompleteInputProps>(
  ({ className, value, onChange, symbols = [], ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasUserTyped, setHasUserTyped] = React.useState(false);
    const [filteredSymbols, setFilteredSymbols] = React.useState<StockSymbol[]>([]);
    const [selectedIndex, setSelectedIndex] = React.useState(-1);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // 入力値に基づいてフィルタリング
    React.useEffect(() => {
      if (!value || value.length < 2) {
        setFilteredSymbols([]);
        setIsOpen(false);
        return;
      }

      const searchTerm = value.toLowerCase();
      const filtered = symbols
        .filter(
          (stock) =>
            stock.symbol.toLowerCase() !== searchTerm && // 完全一致を除外
            (stock.symbol.toLowerCase().includes(searchTerm) ||
            stock.name.toLowerCase().includes(searchTerm))
        )
        .slice(0, 10); // 最大10件表示

      setFilteredSymbols(filtered);
      setIsOpen(filtered.length > 0);
      setSelectedIndex(-1);
    }, [value, symbols]);

    // フォーカス外しでドロップダウンを閉じる
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    // キーボード操作
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || filteredSymbols.length === 0) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredSymbols.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filteredSymbols.length) {
            onChange(filteredSymbols[selectedIndex].symbol);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    // 候補選択
    const handleSelectSymbol = (e: React.MouseEvent, symbol: string) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      onChange(symbol);
    };

    return (
      <div ref={containerRef} className="relative">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => {
            setHasUserTyped(true);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setHasUserTyped(false);
          }}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />

        {/* ドロップダウンリスト */}
        {isFocused && hasUserTyped && isOpen && filteredSymbols.length > 0 && (
          <div className="absolute z-50 mt-1 min-w-full w-max max-w-md rounded-md border border-gray-300 bg-white shadow-lg max-h-60 overflow-auto">
            {filteredSymbols.map((stock, index) => (
              <div
                key={stock.symbol}
                onMouseDown={(e) => handleSelectSymbol(e, stock.symbol)}
                className={cn(
                  'px-3 py-2 cursor-pointer text-sm hover:bg-blue-50',
                  index === selectedIndex && 'bg-blue-100'
                )}
              >
                <div className="font-medium text-gray-900">{stock.symbol}</div>
                <div className="text-xs text-gray-500">{stock.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

AutocompleteInput.displayName = 'AutocompleteInput';

export { AutocompleteInput };
