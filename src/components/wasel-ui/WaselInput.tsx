/**
 * WaselInput - design-system text field.
 */

import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { ANIM, C, F, R, TYPE } from '../../utils/wasel-ds';
import { sanitizeHtml } from '../../utils/sanitization';

interface WaselInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  description?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  dir?: 'ltr' | 'rtl';
  onChange?: (value: string) => void;
}

function PasswordToggle({ showPassword, onToggle }: { showPassword: boolean; onToggle: () => void }) {
  // LanguageProvider isn't guaranteed above every input; /initial-locale.js
  // sets <html lang> before first paint, so read the active language from there.
  const ar = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  const label = ar
    ? (showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور')
    : (showPassword ? 'Hide password' : 'Show password');
  return (
    <button
      type="button"
      onClick={() => { void onToggle(); }}
      aria-label={label}
      aria-pressed={showPassword}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: C.textMuted,
        display: 'inline-flex',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

export function WaselInput({
  label,
  description,
  error,
  hint,
  icon,
  trailing,
  type = 'text',
  dir,
  onChange,
  id,
  style,
  ...rest
}: WaselInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;
  const hasError = Boolean(error);

  // Focus border must hit 3:1 against the field: the old 28%-alpha cyan did not.
  const borderColor = hasError ? C.error : focused ? C.cyan : C.border;
  const boxShadow = hasError
    ? `0 0 0 3px ${C.errorDim}`
    : focused
      ? `0 0 0 3px ${C.cyanGlow}`
      : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {(label || description) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '8px',
          }}
        >
          {label && (
            <label
              htmlFor={inputId}
              style={{
                fontSize: TYPE.size.sm,
                fontWeight: TYPE.weight.bold,
                color: C.textSub,
                fontFamily: F,
                lineHeight: 1.4,
              }}
            >
              {label}
            </label>
          )}
          {description && (
            <span style={{ fontSize: TYPE.size.xs, color: C.textMuted, fontFamily: F }}>
              {description}
            </span>
          )}
        </div>
      )}

      <div
        dir={dir}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 14px',
          minHeight: '50px',
          borderRadius: R.lg,
          background: focused ? C.card2 : C.cardSolid,
          border: `1.5px solid ${borderColor}`,
          boxShadow,
          transition: `border-color ${ANIM.dur.normal} ${ANIM.ease.default}, box-shadow ${ANIM.dur.normal} ${ANIM.ease.default}, background ${ANIM.dur.normal} ${ANIM.ease.default}`,
        }}
      >
        {icon && (
          <span
            style={{ flexShrink: 0, color: C.textMuted, display: 'inline-flex', fontSize: TYPE.size.base }}
          >
            {icon}
          </span>
        )}

        <input
          {...rest}
          id={inputId}
          type={resolvedType}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : rest['aria-describedby']}
          onChange={e => onChange?.(e.target.value)}
          onFocus={e => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: TYPE.size.base,
            fontFamily: F,
            color: C.text,
            textAlign: dir === 'rtl' ? 'right' : dir === 'ltr' ? 'left' : 'start',
            minWidth: 0,
            ...style,
          }}
        />

        {isPassword && (
          <PasswordToggle showPassword={showPassword} onToggle={() => setShowPassword(v => !v)} />
        )}

        {trailing && !isPassword && (
          <span style={{ flexShrink: 0, display: 'inline-flex' }}>{trailing}</span>
        )}
      </div>

      {error && (
        <span id={errorId} role="alert" style={{ fontSize: TYPE.size.xs, color: C.error, fontFamily: F, lineHeight: 1.5 }}>
          {sanitizeHtml(error)}
        </span>
      )}

      {hint && !error && hint}
    </div>
  );
}
