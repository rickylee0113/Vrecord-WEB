
export type TeamSide = 'Home' | 'Away';

export type PlayerRole = 'OH' | 'MB' | 'OP' | 'S' | 'L' | 'DS' | '?';

export interface Player {
  id: string;
  number: string;
  name: string;
  role?: PlayerRole;
  avatar?: string; // Optional URL for player image
}

export interface Team {
  name: string;
  roster: Player[];
}

export type SkillType = 'Serve' | 'Receive' | 'Set' | 'Attack' | 'Block' | 'Dig' | 'Freeball' | 'Fault' | 'Substitution';

export type SkillSubType = 'QuickA' | 'QuickB' | 'QuickC' | 'Open' | 'BackRow' | 'Tip' | 'Tool' | 'Float' | 'Spin' | 'NetTouch' | 'DoubleHit' | 'Violation' | 'Out' | 'Carry' | 'Rotation' | 'SetA' | 'SetB' | 'SetC' | 'SetOpen' | 'SetSlide';

export type GradeType = '#' | '+' | '!' | '-' | '=';

export type Zone = 1 | 2 | 3 | 4 | 5 | 6;

export type ResultType = 'Point' | 'Error' | 'Continue';

export interface Coordinate {
    x: number;
    y: number;
}

export interface MatchMetadata {
  date: string;
  tournament: string;
  homeTeam: Team;
  awayTeam: Team;
}

export interface Lineup {
  home: { [key in Zone]: Player | null } & { L: Player | null };
  away: { [key in Zone]: Player | null } & { L: Player | null };
}

export interface TagEvent {
  id: string;
  timestamp: number; // Video time in seconds
  matchTimeFormatted: string; // MM:SS
  team: TeamSide;
  playerNumber: string;
  skill: SkillType;
  subType?: SkillSubType; // New field for sub-types
  grade?: GradeType; // New field for Grading (#, +, !, -, =)
  startZone: Zone;
  endZone: Zone;
  startCoordinate?: Coordinate; // Precise X/Y
  endCoordinate?: Coordinate; // Precise X/Y
  result: ResultType;
  set: number;
  tags?: string[];
}

// Partial event used while the user is clicking through the sequence
export interface PendingEvent {
  team?: TeamSide;
  playerNumber?: string;
  skill?: SkillType;
  subType?: SkillSubType;
  grade?: GradeType;
  startZone?: Zone;
  endZone?: Zone;
  startCoordinate?: Coordinate;
  endCoordinate?: Coordinate;
  result?: ResultType;
  tags?: string[];
}
