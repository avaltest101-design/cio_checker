// Reusable upload panel for PDFs and images.
import React, { useRef, useState } from "react";

export default function UploadBox({
  accept = ".pdf",
  label = "Upload file",
  hint = "Drag & drop or click to browse",
  onFile,
  fileName,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files[0] && onFile) onFile(files[0]);
  };

  return (
    <div
      className={`upload-box ${dragging ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="upload-icon" aria-hidden="true">⤓</div>
      <div className="upload-label">{fileName || label}</div>
      <div className="upload-hint">{fileName ? "Click to replace" : hint}</div>
    </div>
  );
}
