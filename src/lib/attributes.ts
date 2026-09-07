export type SkaterAttribute =
  | "mobility"
  | "shooting"
  | "control"
  | "sense"
  | "strength"
  | "playmaking"
  | "anticipation"
  | "disruption"
  | "coverage";

export type GoalieAttribute =
  | "mobility"
  | "blocker"
  | "glove"
  | "tracking"
  | "reboundControl"
  | "positioning";

export type Attribute = SkaterAttribute | GoalieAttribute;

export const SKATER_ATTRIBUTES: SkaterAttribute[] = [
  "mobility",
  "sense",
  "strength",
  "control",
  "shooting",
  "playmaking",
  "anticipation",
  "disruption",
  "coverage",
];

/**
 * Skater attributes grouped into 3 categories for display (voting page,
 * rating history picker, ranking card hover-preview). Goalies don't have
 * categories — GOALIE_ATTRIBUTES stays one flat list. All 9 attributes
 * here still factor into a skater's Overall score the same way, via
 * SKATER_ATTRIBUTES/attributesForPosition — this is a presentation
 * grouping only, not a separate scoring track (unlike boosters).
 */
export type AttributeCategory = "general" | "offense" | "defense";

export const ATTRIBUTE_CATEGORIES: { key: AttributeCategory; label: string; attributes: SkaterAttribute[] }[] = [
  { key: "general", label: "General", attributes: ["mobility", "sense", "strength"] },
  { key: "offense", label: "Offense", attributes: ["control", "shooting", "playmaking"] },
  { key: "defense", label: "Defense", attributes: ["anticipation", "disruption", "coverage"] },
];

export const GOALIE_ATTRIBUTES: GoalieAttribute[] = [
  "mobility",
  "blocker",
  "glove",
  "tracking",
  "reboundControl",
  "positioning",
];

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  mobility: "Mobility",
  shooting: "Shooting",
  control: "Control",
  sense: "Sense",
  strength: "Strength",
  playmaking: "Playmaking",
  anticipation: "Anticipation",
  disruption: "Disruption",
  coverage: "Coverage",
  blocker: "Blocker",
  glove: "Glove",
  tracking: "Tracking",
  reboundControl: "Rebound Control",
  positioning: "Positioning",
};

export type SkaterPosition = "C" | "LW" | "RW" | "D";
export type Position = SkaterPosition | "G";

export function isGoaliePosition(position: Position): position is "G" {
  return position === "G";
}

export function attributesForPosition(position: Position): Attribute[] {
  return isGoaliePosition(position) ? GOALIE_ATTRIBUTES : SKATER_ATTRIBUTES;
}

export function isValidAttributeForPosition(
  attribute: string,
  position: Position
): attribute is Attribute {
  return (attributesForPosition(position) as string[]).includes(attribute);
}

/**
 * Booster attributes are votable on every player and goalie alike — unlike
 * the six position-specific attributes, they're not part of that position's
 * set and never factor into the Overall score. They're also deliberately
 * excluded from the rankings hover preview (see PlayerCard).
 */
export type BoosterAttribute = "potential" | "leadership";

export const BOOSTER_ATTRIBUTES: BoosterAttribute[] = ["potential", "leadership"];

export const BOOSTER_ATTRIBUTE_LABELS: Record<BoosterAttribute, string> = {
  potential: "Potential",
  leadership: "Leadership",
};

export function isBoosterAttribute(attribute: string): attribute is BoosterAttribute {
  return (BOOSTER_ATTRIBUTES as string[]).includes(attribute);
}

/** Valid for voting: either this position's own attribute, or a universal booster. */
export function isValidVotableAttribute(
  attribute: string,
  position: Position
): attribute is Attribute | BoosterAttribute {
  return isValidAttributeForPosition(attribute, position) || isBoosterAttribute(attribute);
}

const ALL_VOTABLE_ATTRIBUTES: ReadonlySet<string> = new Set<string>([
  ...SKATER_ATTRIBUTES,
  ...GOALIE_ATTRIBUTES,
  ...BOOSTER_ATTRIBUTES,
]);

/** Position-agnostic check — the client only ever renders a player's own
 *  attributes, so the vote route just needs to reject outright garbage
 *  without spending a DB round trip to look the player's position up. */
export function isKnownVotableAttribute(attribute: string): attribute is Attribute | BoosterAttribute {
  return ALL_VOTABLE_ATTRIBUTES.has(attribute);
}

export const POSITION_LABELS: Record<Position, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goalie",
};

export const SKATER_POSITIONS: SkaterPosition[] = ["C", "LW", "RW", "D"];
