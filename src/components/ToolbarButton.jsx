export function ToolbarButton({ children, icon, isActive = false, ...props }) {
  return (
    <button className={isActive ? "toolbar-button is-active" : "toolbar-button"} type="button" {...props}>
      <span aria-hidden="true" className="toolbar-button__icon">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}

