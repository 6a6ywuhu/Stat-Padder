export type SkaterAttribute =
  | "mobility"
  | "shooting"
  | "control"
  | "sense"
  | "strength"
  | "playmaking";

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
  "shooting",
  "control",
  "sense",
  "strength",
  "playmaking",
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

export const POSITION_LABELS: Record<Position, string> = {
  C: "Center",
  LW: "Left Wing",
  RW: "Right Wing",
  D: "Defenseman",
  G: "Goalie",
};

export const SKATER_POSITIONS: SkaterPosition[] = ["C", "LW", "RW", "D"];
