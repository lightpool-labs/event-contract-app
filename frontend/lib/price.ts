type ParsedDecimal = {
  int: bigint;
  scale: number;
};

function normalizedTickFraction(tickSize: string): string {
  const trimmed = tickSize.trim();
  const dot = trimmed.indexOf(".");
  if (dot === -1) {
    return "";
  }
  return trimmed.slice(dot + 1).replace(/0+$/, "");
}

function parseDecimalString(value: string): ParsedDecimal | null {
  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = unsigned.split(".");
  const scale = frac.length;
  const digits = `${whole}${frac}`;
  const int = BigInt(digits);
  return { int: negative ? -int : int, scale };
}

function pow10(exp: number): bigint {
  return BigInt(10) ** BigInt(exp);
}

function formatScaledInt(value: bigint, scale: number, displayDecimals: number): string {
  const zero = BigInt(0);
  const negative = value < zero;
  const abs = negative ? -value : value;

  if (scale > displayDecimals) {
    const factor = pow10(scale - displayDecimals);
    const half = factor / BigInt(2);
    const rounded = (abs + half) / factor;
    return formatScaledInt(negative ? -rounded : rounded, displayDecimals, displayDecimals);
  }

  const paddedScale = Math.max(scale, displayDecimals);
  const padded = abs.toString().padStart(paddedScale + 1, "0");
  const wholeLen = padded.length - paddedScale;
  const whole = padded.slice(0, wholeLen) || "0";
  let frac = padded.slice(wholeLen).padEnd(displayDecimals, "0");

  if (displayDecimals > 0) {
    frac = frac.slice(0, displayDecimals).replace(/0+$/, "");
  }

  if (displayDecimals === 0 || frac.length === 0) {
    return `${negative ? "-" : ""}${whole}`;
  }

  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function centDecimalPlacesFromTick(tickSize: string): number {
  const fraction = normalizedTickFraction(tickSize);
  if (fraction.length <= 2) {
    return 0;
  }
  return fraction.length - 2;
}

export function centPriceStepFromTick(tickSize: string): string {
  const parsed = parseDecimalString(tickSize);
  if (!parsed || parsed.int <= BigInt(0)) {
    return "1";
  }

  const displayDecimals = centDecimalPlacesFromTick(tickSize);
  const centInt = parsed.int * BigInt(100);
  const centScale = parsed.scale;
  return formatScaledInt(centInt, centScale, displayDecimals);
}

export function formatPriceCents(price: string, tickSize: string): string {
  const parsed = parseDecimalString(price);
  if (!parsed) {
    return price;
  }

  return formatScaledInt(parsed.int, parsed.scale, centDecimalPlacesFromTick(tickSize));
}

export function subtractPriceCents(ask: string, bid: string, tickSize: string): string | null {
  const askParsed = parseDecimalString(ask);
  const bidParsed = parseDecimalString(bid);
  if (!askParsed || !bidParsed) {
    return null;
  }

  const scale = Math.max(askParsed.scale, bidParsed.scale);
  const askUnits = askParsed.int * pow10(scale - askParsed.scale);
  const bidUnits = bidParsed.int * pow10(scale - bidParsed.scale);
  const diff = askUnits - bidUnits;
  return formatScaledInt(diff, scale, centDecimalPlacesFromTick(tickSize));
}
