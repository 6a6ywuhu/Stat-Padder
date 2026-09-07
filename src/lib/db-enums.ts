/**
 * SQLite has no native enum type, so the columns that used to be Prisma
 * enums (Player.position / Player.status, Report.type / Report.status) are
 * plain TEXT. These are the allowed values, kept here so the rest of the
 * app still has real union types and a runtime list to validate against.
 */

export const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export type Position = (typeof POSITIONS)[number];

export const PLAYER_STATUSES = ["ACTIVE", "RETIRED", "INJURED"] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const REPORT_TYPES = ["DATA_ISSUE", "VOTE_SPIKE"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
