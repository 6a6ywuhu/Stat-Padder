/**
 * Static, hand-maintained team color data. The NHL API doesn't expose
 * brand colors, so this file is the single source of truth for the
 * grayscale-plus-team-accent system (spec section 9). Everything else
 * about a team (name, city, conference, division, roster) is synced live
 * from the NHL API and is safe to overwrite; this file is not.
 */
export type TeamColor = {
  primary: string;
  secondary: string;
};

export const TEAM_COLORS: Record<string, TeamColor> = {
  ANA: { primary: "#F47A38", secondary: "#111111" },
  UTA: { primary: "#71AFE5", secondary: "#010101" },
  BOS: { primary: "#FFB81C", secondary: "#000000" },
  BUF: { primary: "#002654", secondary: "#FCB514" },
  CGY: { primary: "#C8102E", secondary: "#F1BE48" },
  CAR: { primary: "#CC0000", secondary: "#000000" },
  CHI: { primary: "#CF0A2C", secondary: "#000000" },
  COL: { primary: "#6F263D", secondary: "#236192" },
  CBJ: { primary: "#002654", secondary: "#CE1126" },
  DAL: { primary: "#006847", secondary: "#8F8F8C" },
  DET: { primary: "#CE1126", secondary: "#B5B5B5" },
  EDM: { primary: "#041E42", secondary: "#FF4C00" },
  FLA: { primary: "#C8102E", secondary: "#041E42" },
  LAK: { primary: "#111111", secondary: "#A2AAAD" },
  MIN: { primary: "#154734", secondary: "#A6192E" },
  MTL: { primary: "#AF1E2D", secondary: "#192168" },
  NSH: { primary: "#FFB81C", secondary: "#041E42" },
  NJD: { primary: "#CE1126", secondary: "#000000" },
  NYI: { primary: "#00539B", secondary: "#F47D30" },
  NYR: { primary: "#0038A8", secondary: "#CE1126" },
  OTT: { primary: "#C52032", secondary: "#000000" },
  PHI: { primary: "#F74902", secondary: "#000000" },
  PIT: { primary: "#FCB514", secondary: "#000000" },
  SJS: { primary: "#006D75", secondary: "#EA7200" },
  SEA: { primary: "#99D9D9", secondary: "#001628" },
  STL: { primary: "#002F87", secondary: "#FCB514" },
  TBL: { primary: "#002868", secondary: "#8A8D8F" },
  TOR: { primary: "#00205B", secondary: "#A2AAAD" },
  VAN: { primary: "#00205B", secondary: "#00843D" },
  VGK: { primary: "#B4975A", secondary: "#333F42" },
  WSH: { primary: "#C8102E", secondary: "#041E42" },
  WPG: { primary: "#041E42", secondary: "#AC162C" },
};

export function teamLogoUrl(abbrev: string, mode: "light" | "dark"): string {
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_${mode}.svg`;
}

export function getTeamColor(abbrev: string): TeamColor {
  return TEAM_COLORS[abbrev] ?? { primary: "#6B7280", secondary: "#374151" };
}
