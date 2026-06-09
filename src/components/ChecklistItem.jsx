// A single toggleable checklist row used on guidance + report pages.
import React from "react";

export default function ChecklistItem({ text, checked, onToggle }) {
  return (
    <label className="checklist-item">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={onToggle}
      />
      <span className={checked ? "checked" : ""}>{text}</span>
    </label>
  );
}
