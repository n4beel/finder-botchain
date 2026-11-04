import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  styling?: "card" | "contrast" | "strip";
}

export function Panel({
  styling = "card",
  className = "",
  children,
  ...domProps
}: PanelProps) {
  let box = "border rounded-lg ";

  if (styling === "contrast") {
    box += "bg-[#264653] border-[#1d353f] text-white p-5 shadow-md ";
  } else if (styling === "strip") {
    box += "bg-[#FFFDF5] border-[#CEAD5B] p-4 text-[#2B1D00] shadow-2xs ";
  } else {
    box += "bg-[#FFF8E0] border-[#B4954C] p-5 text-[#2B1D00] shadow-sm ";
  }

  return (
    <div className={`${box} ${className}`} {...domProps}>
      {children}
    </div>
  );
}

export default Panel;
