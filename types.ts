
export enum WeekType {
  A = 'Week A',
  B = 'Week B'
}

export enum CoreType {
  SpineFlexion = 'Spine Flexion',
  NoFlexion = 'No Flexion'
}

export enum CardioMode {
  Aerobic = 'Aerobic',
  Anaerobic = 'Anaerobic'
}

export interface Exercise {
  name: string;
  sets: number;
  baseReps: string; // e.g., "5-8" or "10"
  unit?: string; // e.g., "seconds"
  isFailure?: boolean;
}

export interface WorkoutBlock {
  title: string;
  exercises: Exercise[];
}

export interface DailyWorkout {
  date: Date;
  weekType: WeekType;
  weekNumber: number;
  blocks: WorkoutBlock[];
  cardio: CardioMode | null;
  dayName: string;
}

export interface MonthData {
  name: string;
  year: number;
  days: DailyWorkout[];
}
