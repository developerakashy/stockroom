import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";

interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  id,
  labelId,
  value,
  options,
  className = "",
  onChange,
  clear,
}: {
  id: string;
  labelId: string;
  value: string;
  options: FilterOption[];
  className?: string;
  onChange: (value: string) => void;
  clear?: { label: string; onClick: () => void };
}) {
  const [pointerSelection, setPointerSelection] = useState(false);
  return (
    <div className="filter-select-field">
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          id={id}
          data-pointer-selection={pointerSelection}
          onBlur={() => setPointerSelection(false)}
          onKeyDown={() => setPointerSelection(false)}
          aria-labelledby={labelId}
          className={`filter-select-trigger ${className}`}
        >
          <Select.Value />
          <Select.Icon asChild>
            <ChevronDown
              className="filter-select-chevron"
              size={14}
              aria-hidden="true"
            />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={5}
            className="filter-select-menu"
          >
            <Select.ScrollUpButton className="filter-select-scroll">
              <ChevronUp size={14} aria-hidden="true" />
            </Select.ScrollUpButton>
            <Select.Viewport className="filter-select-options">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  onPointerDown={() => setPointerSelection(true)}
                  onKeyDown={() => setPointerSelection(false)}
                  value={option.value}
                  className="filter-select-option"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="filter-select-check">
                    <Check size={14} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="filter-select-scroll">
              <ChevronDown size={14} aria-hidden="true" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {clear && (
        <button
          type="button"
          className="inline-filter-clear"
          aria-label={clear.label}
          title={clear.label}
          onClick={clear.onClick}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
