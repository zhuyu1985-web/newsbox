"use client";

import * as React from "react";

// Radix 推荐：当视觉上不需要标题，但可访问性需要时使用
// https://www.radix-ui.com/primitives/docs/utilities/visually-hidden
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(function VisuallyHidden({ style, ...props }, ref) {
  return (
    <span
      ref={ref}
      style={{
        position: "absolute",
        border: 0,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        wordWrap: "normal",
        ...style,
      }}
      {...props}
    />
  );
});


