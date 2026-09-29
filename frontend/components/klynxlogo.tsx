export const KLYNX_ICON = "/icons/xicon.png";

type KlynxLogoProps = {
  variant?: "icon" | "wordmark" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function KlynxLogo({
  variant = "wordmark",
  size = "md",
  className = "",
}: KlynxLogoProps) {
  const textSize = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  const iconSize = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  }[size];

  const wordmark = (
    <span
      className={`inline-flex items-center font-syne font-semibold tracking-tight ${textSize}`}
    >
      <span className="text-text">KLYN</span>
      <span className="bg-gradient-to-r from-[#C8F065] from-50% to-[#F06AAA] to-50% bg-clip-text text-transparent">X</span>
      <span className="ml-0.5 text-[0.72em] font-medium text-[#F06AAA]">OS</span>
    </span>
  );

  if (variant === "icon") {
    return (
      <img
        src={KLYNX_ICON}
        alt="Klynx"
        className={`${iconSize} object-contain ${className}`}
      />
    );
  }

  if (variant === "full") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={KLYNX_ICON}
          alt=""
          className={`${iconSize} object-contain`}
        />
        {wordmark}
      </span>
    );
  }

  return <span className={className}>{wordmark}</span>;
}