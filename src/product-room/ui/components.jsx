import React, { Children, cloneElement, isValidElement, useId } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import "./tokens.css";
import "./components.css";

const classes = (...values) => values.filter(Boolean).join(" ");

export function Glyph({ name = "arrow", className = "", ...props }) {
  const paths = {
    arrow: "M4 12h15m-6-6 6 6-6 6",
    back: "M20 12H5m6-6-6 6 6 6",
    check: "m5 12 4 4L19 6",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    info: "M12 11v6M12 7v.1",
    document: "M14 3H5v18h14V8l-5-5v5h5M8 12h8M8 16h6",
    external: "M13 4h7v7m0-7L9 15M11 4H4v16h16v-7",
    replay: "M4 10a8 8 0 1 1 .7 7M4 4v6h6",
  };
  return (
    <svg
      {...props}
      className={classes("ar-glyph", className)}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "info" && <circle cx="12" cy="12" r="9" />}
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}

/** A pending action keeps its dimensions and focus; Base UI blocks activation. */
export function Button({
  variant = "primary",
  pending = false,
  pendingLabel = "Saving…",
  disabled = false,
  children,
  icon,
  className = "",
  type = "button",
  ...props
}) {
  const appearance = variant === "ghost" ? "quiet" : variant;
  const labelId = useId();
  return (
    <BaseButton
      {...props}
      type={type}
      disabled={disabled || pending}
      focusableWhenDisabled={pending}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      data-variant={appearance}
      aria-labelledby={
        pending
          ? `${labelId}-pending`
          : props["aria-labelledby"] ||
            (!props["aria-label"] ? labelId : undefined)
      }
      className={classes("ar-button", className)}
    >
      <span className="ar-button-labels">
        <span
          id={labelId}
          className="ar-button-label"
          aria-hidden={pending || undefined}
        >
          {children}
        </span>
        <span
          id={`${labelId}-pending`}
          className="ar-button-pending"
          aria-hidden={!pending}
        >
          <span className="ar-spinner" aria-hidden="true" />
          {pendingLabel}
        </span>
      </span>
      {icon && <Glyph name={icon} className="ar-button-icon" />}
    </BaseButton>
  );
}

export function ActionGroup({
  children,
  align = "end",
  className = "",
  ...props
}) {
  return (
    <div
      {...props}
      className={classes("ar-actions", `ar-actions-${align}`, className)}
    >
      {children}
    </div>
  );
}

/** Field can author a native control or add its accessible contract to one child. */
export function Field({
  label,
  hint,
  error,
  optional = false,
  textarea = false,
  options,
  unit,
  children,
  className = "",
  id: givenId,
  ...props
}) {
  const generatedId = useId();
  const child =
    Children.count(children) === 1 && isValidElement(children)
      ? children
      : null;
  const id = givenId || child?.props.id || generatedId;
  const describedBy = [
    child?.props["aria-describedby"],
    props["aria-describedby"],
    hint && `${id}-hint`,
    error && `${id}-error`,
    unit && `${id}-unit`,
  ]
    .filter(Boolean)
    .join(" ");
  const shared = {
    ...props,
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    className: classes("ar-input", child?.props.className),
  };
  let input;
  if (child)
    input = cloneElement(child, {
      ...shared,
      ...child.props,
      id,
      className: shared.className,
      "aria-describedby": shared["aria-describedby"],
      "aria-invalid": shared["aria-invalid"],
    });
  else if (children) input = children;
  else if (options)
    input = (
      <select {...shared}>
        {options.map((option) => {
          const [value, text] = Array.isArray(option)
            ? option
            : [option.value, option.label];
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    );
  else if (textarea) input = <textarea {...shared} />;
  else input = <input {...shared} />;
  return (
    <div className={classes("ar-field", className)}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="ar-optional">Optional</span>}
      </label>
      <div className={classes("ar-input-wrap", unit && "ar-input-with-unit")}>
        {input}
        {unit && (
          <span className="ar-unit" id={`${id}-unit`}>
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p className="ar-help" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="ar-field-error" id={`${id}-error`}>
          <Glyph name="info" />
          {error}
        </p>
      )}
    </div>
  );
}

export function Status({
  tone = "neutral",
  children,
  className = "",
  ...props
}) {
  return (
    <span
      {...props}
      className={classes("ar-status", className)}
      data-tone={tone}
    >
      <span className="ar-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
export const Badge = Status;

export function Evidence({
  kind = "model",
  children,
  className = "",
  ...props
}) {
  const labels = {
    model: "Model reference",
    customer: "Customer input",
    sample: "Sample data",
    review: "Review required",
  };
  return (
    <span
      {...props}
      className={classes("ar-evidence", className)}
      data-kind={kind}
    >
      <Glyph name={kind === "customer" ? "check" : "document"} />
      {children || labels[kind] || labels.model}
    </span>
  );
}

export function Notice({
  kind = "neutral",
  tone,
  title,
  children,
  role,
  className = "",
  ...props
}) {
  const style = tone || kind;
  return (
    <div
      {...props}
      className={classes("ar-notice", className)}
      data-kind={style}
      role={role || (style === "error" ? "alert" : undefined)}
    >
      <Glyph name={style === "success" ? "check" : "info"} />
      <div>
        {title && <strong>{title}</strong>}
        {children && <div className="ar-notice-body">{children}</div>}
      </div>
    </div>
  );
}

export function Section({
  title,
  eyebrow,
  description,
  actions,
  children,
  className = "",
  id,
  ...props
}) {
  const generatedId = useId(),
    titleId = id ? `${id}-title` : generatedId;
  return (
    <section
      {...props}
      id={id}
      aria-labelledby={title ? titleId : undefined}
      className={classes("ar-section", className)}
    >
      {(title || eyebrow || description || actions) && (
        <header className="ar-section-header">
          <div>
            {eyebrow && <p className="ar-eyebrow">{eyebrow}</p>}
            {title && <h2 id={titleId}>{title}</h2>}
            {description && (
              <p className="ar-section-description">{description}</p>
            )}
          </div>
          {actions && <div className="ar-section-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, children }) {
  return (
    <div className="ar-empty">
      <Glyph name="document" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children && <ActionGroup align="start">{children}</ActionGroup>}
    </div>
  );
}

export function VersionSelector({
  versions,
  value,
  onChange,
  label = "Quote version",
  className = "",
}) {
  const id = useId(),
    latest = versions.at(-1);
  const selected = versions.find((item) => String(item.id) === String(value));
  return (
    <div className={classes("ar-version-selector", className)}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="ar-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {versions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label || `Version ${item.version}`}
            {item.id === latest?.id ? " · Latest" : ""}
          </option>
        ))}
      </select>
      {selected && (
        <span className="ar-version-note">
          {selected.id === latest?.id ? "Latest version" : "Earlier version"} ·
          History preserved
        </span>
      )}
    </div>
  );
}

function ComparisonValue({ value, changedOnly }) {
  if (value?.kind === "line-item") {
    const facts = changedOnly
      ? value.facts.filter((fact) => fact.changed)
      : value.facts;
    return (
      <dl className="ar-comparison-facts">
        {facts.map((fact) => (
          <div key={fact.key} data-changed={fact.changed || undefined}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return value ?? "To confirm";
}

export function Comparison({
  rows,
  beforeLabel = "Previous",
  afterLabel = "Revised",
  caption = "Version comparison",
  changedOnly = false,
  className = "",
}) {
  return (
    <div className={classes("ar-comparison", className)} data-changed-only={changedOnly || undefined}>
      <table role="table">
        <caption className="ar-sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Detail</th>
            <th scope="col">{beforeLabel}</th>
            <th scope="col">{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => {
            const {
              label,
              labelDisplay,
              before,
              after,
              beforeDisplay = before,
              afterDisplay = after,
              changed = before !== after,
            } = Array.isArray(item)
              ? { label: item[0], before: item[1], after: item[2] }
              : item;
            return (
              <tr key={item.key || `${label}-${index}`} data-changed={changed || undefined}>
                <th scope="row">
                  {labelDisplay ?? label}
                  {changed && <span className={changedOnly ? "ar-sr-only" : "ar-change-label"}> Changed</span>}
                </th>
                <td data-column={beforeLabel} className="ar-comparison-previous">
                  <span className="ar-comparison-column" aria-hidden="true">{beforeLabel}</span>
                  <ComparisonValue value={beforeDisplay} changedOnly={changedOnly} />
                </td>
                <td data-column={afterLabel} className="ar-comparison-current">
                  <span className="ar-comparison-column" aria-hidden="true">{afterLabel}</span>
                  <ComparisonValue value={afterDisplay} changedOnly={changedOnly} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
