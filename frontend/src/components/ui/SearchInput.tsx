import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChangeValue: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeValue,
  placeholder = 'Search records...',
  className = '',
  ...props
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-[#FAF8F5] hover:bg-[#FAF8F5]/80 focus:bg-white border border-[rgba(45,45,45,0.12)] focus:border-[#C79A3B] focus:ring-1 focus:ring-[#C79A3B]/30 rounded-xl text-xs text-[#1C1C1C] placeholder:text-[#707070]/60 outline-none transition-all"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChangeValue('')}
          aria-label="Clear search"
          className="absolute right-2.5 p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
