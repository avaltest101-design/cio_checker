// Compliance disclaimer shown in the footer and on every review page.
import React from "react";
import { DEFAULT_RULES } from "../utils/coiRules.js";

export default function Disclaimer({ settings, inline = false }) {
  const text = settings?.disclaimer || DEFAULT_RULES.disclaimer;
  return (
    <div className={inline ? "disclaimer disclaimer-inline" : "disclaimer"}>
      <span className="disclaimer-icon" aria-hidden="true">ⓘ</span>
      <span>{text}</span>
    </div>
  );
}
