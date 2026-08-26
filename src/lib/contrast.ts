/** Picks black or white text for readable contrast against a hex background. */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.45 ? "#000000" : "#ffffff";
}

export type TeamAccentStyle = {
  "--team-primary": string;
  "--team-secondary": string;
  "--team-primary-fg": string;
};

export function teamAccentStyle(primary: string, secondary: string): TeamAccentStyle {
  return {
    "--team-primary": primary,
    "--team-secondary": secondary,
    "--team-primary-fg": readableTextColor(primary),
  };
}
