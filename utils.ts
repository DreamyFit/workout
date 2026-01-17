
import { 
  DailyWorkout, 
  WeekType, 
  CardioMode, 
  WorkoutBlock 
} from './types';
import { 
  BACK_BLOCK, 
  CORE_FLEXION_BLOCK, 
  CORE_NO_FLEXION_BLOCK, 
  CHEST_ARMS_SHOULDERS_BLOCK, 
  LEG_FOUNDATION_BLOCK 
} from './constants';

export function calculateProgressiveReps(baseReps: string, weekNumber: number): string {
  return baseReps;
}

export function generateCalendarForRange(startYear: number, startMonth: number, monthsCount: number): DailyWorkout[] {
  const result: DailyWorkout[] = [];
  const startDate = new Date(startYear, startMonth, 1);
  const endDate = new Date(startYear, startMonth + monthsCount, 1);
  
  let coreSessionCount = 0;
  let currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const diffTime = Math.abs(currentDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor((diffDays + startDate.getDay()) / 7);
    const weekNumber = weekIndex + 1;
    const weekType = weekNumber % 2 !== 0 ? WeekType.A : WeekType.B;

    let blocks: WorkoutBlock[] = [];
    let cardio: CardioMode | null = null;

    const getCoreBlock = () => {
      const block = coreSessionCount % 2 === 0 ? CORE_FLEXION_BLOCK : CORE_NO_FLEXION_BLOCK;
      coreSessionCount++;
      return block;
    };

    // Week A: 3x Anaerobic (Mon, Wed, Sat)
    // Week B: 2x Anaerobic (Mon, Sat)
    const isAnaerobicDay = (day: string, wType: WeekType) => {
      if (wType === WeekType.A) {
        return ['Monday', 'Wednesday', 'Saturday'].includes(day);
      } else {
        return ['Monday', 'Saturday'].includes(day);
      }
    };

    switch (dayName) {
      case 'Sunday':
        blocks = [getCoreBlock()];
        cardio = CardioMode.Aerobic;
        break;
      case 'Monday':
        blocks = [
          { ...BACK_BLOCK, title: "Back" },
          { ...CHEST_ARMS_SHOULDERS_BLOCK, title: "CAS" }
        ];
        cardio = CardioMode.Anaerobic;
        break;
      case 'Tuesday':
        blocks = [getCoreBlock(), { ...LEG_FOUNDATION_BLOCK, title: "Lower" }];
        break;
      case 'Wednesday':
        blocks = [{ ...BACK_BLOCK, title: "Back" }];
        cardio = weekType === WeekType.A ? CardioMode.Anaerobic : CardioMode.Aerobic;
        break;
      case 'Thursday':
        blocks = [getCoreBlock(), { ...LEG_FOUNDATION_BLOCK, title: "Lower" }];
        break;
      case 'Friday':
        blocks = [{ ...CHEST_ARMS_SHOULDERS_BLOCK, title: "CAS" }];
        cardio = CardioMode.Aerobic;
        break;
      case 'Saturday':
        blocks = [
          { ...BACK_BLOCK, title: "Back" },
          { ...CHEST_ARMS_SHOULDERS_BLOCK, title: "CAS" }
        ];
        cardio = CardioMode.Anaerobic;
        break;
    }

    const progressiveBlocks = blocks.map(block => ({
      ...block,
      exercises: block.exercises.map(ex => ({
        ...ex,
        baseReps: calculateProgressiveReps(ex.baseReps, weekNumber)
      }))
    }));

    result.push({
      date: new Date(currentDate),
      weekType,
      weekNumber,
      blocks: progressiveBlocks,
      cardio,
      dayName
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }
  return result;
}
