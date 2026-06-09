type MarketIconProps = {
  iconUrl?: string | null;
  question: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-14 w-14 text-lg",
};

export function MarketIcon({
  iconUrl,
  question,
  size = "md",
  className = "",
}: MarketIconProps) {
  const sizeClass = sizeClasses[size];
  const fallbackLetter = question.trim().charAt(0).toUpperCase() || "?";

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={["shrink-0 rounded-lg object-cover", sizeClass, className].join(" ")}
      />
    );
  }

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-lg bg-sky-100 font-semibold text-sky-700",
        sizeClass,
        className,
      ].join(" ")}
    >
      {fallbackLetter}
    </div>
  );
}
