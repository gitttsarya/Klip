import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [hoveredBtn, setHoveredBtn] = useState<"min" | "max" | "close" | null>(null);

  const handleMinimize = () => appWindow.minimize().catch(() => {});
  const handleMaximize = () => appWindow.toggleMaximize().catch(() => {});
  const handleClose = () => appWindow.close().catch(() => {});

  return (
    <div
      className="title-bar"
      onDoubleClick={handleMaximize}
      data-tauri-drag-region
    >

      <div className="title-bar-controls">
        <button
          className="title-bar-btn"
          onClick={handleMinimize}
          onMouseEnter={() => setHoveredBtn("min")}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{ background: hoveredBtn === "min" ? "rgba(255,255,255,0.1)" : "transparent" }}
          title="Minimize"
          aria-label="Minimize window"
        >
          <Minus size={12} strokeWidth={2} />
        </button>



        <button
          className="title-bar-btn title-bar-btn-close"
          onClick={handleClose}
          onMouseEnter={() => setHoveredBtn("close")}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            background: hoveredBtn === "close" ? "#E81123" : "transparent",
            color: hoveredBtn === "close" ? "#fff" : undefined,
          }}
          title="Close"
          aria-label="Close window"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
