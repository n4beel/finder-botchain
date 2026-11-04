import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: "relay" | "danger" | "ghost" | "gold";
  tier?: "sm" | "md" | "lg";
  busy?: boolean;
}

export function Button({
  intent = "relay",
  tier = "md",
  busy = false,
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  let classes =
    "inline-flex items-center justify-center font-medium rounded-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans ";

  if (tier === "sm") {
    classes += "px-3 py-1.5 text-xs ";
  } else if (tier === "lg") {
    classes += "px-6 py-3 text-base font-bold ";
  } else {
    classes += "px-4 py-2 text-sm ";
  }

  if (intent === "relay") {
    classes += "bg-[#264653] text-white hover:bg-[#1a313b] focus:ring-[#264653] shadow-xs ";
  } else if (intent === "gold") {
    classes += "bg-[#E9C46A] text-[#2B1D00] font-bold border border-[#B4954C] hover:bg-[#dfb753] focus:ring-[#E9C46A] ";
  } else if (intent === "danger") {
    classes += "bg-[#B3261E] text-white hover:bg-red-800 focus:ring-[#B3261E] ";
  } else {
    classes += "bg-transparent text-[#2B1D00] border border-[#B4954C] hover:bg-[#F5E5B5] focus:ring-[#264653] ";
  }

  return (
    <button className={`${classes} ${className}`} disabled={disabled || busy} {...rest}>
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default Button;
