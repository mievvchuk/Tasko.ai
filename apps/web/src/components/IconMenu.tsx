import { useId, useState } from "react";

export interface IconMenuOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

// Кнопка-іконка зі списком варіантів (тема, мова): займає мало місця у верхній панелі.
export function IconMenu<T extends string>({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: string;
  label: string;
  value: T;
  options: IconMenuOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div
      className="icon-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="icon-menu-button"
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <i className={`bi ${icon}`} aria-hidden="true"></i>
      </button>
      {open && (
        <>
          <div
            className="account-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <ul className="icon-menu-list" id={id} aria-label={label}>
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  aria-pressed={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.icon && (
                    <i className={`bi ${option.icon}`} aria-hidden="true"></i>
                  )}
                  <span>{option.label}</span>
                  {option.value === value && (
                    <i className="bi bi-check2 icon-menu-check" aria-hidden="true"></i>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
