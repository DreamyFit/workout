
import { Exercise, WorkoutBlock } from './types';

export const BACK_BLOCK: WorkoutBlock = {
  title: "Posture & Back Block",
  exercises: [
    { name: "Pull-Ups or Chin-Ups", sets: 3, baseReps: "6", isFailure: true },
    { name: "Inverted Rows", sets: 2, baseReps: "13" },
    { name: "T-Bar Row or Bent Over Row", sets: 3, baseReps: "11" },
    { name: "Romanian Deadlifts", sets: 3, baseReps: "13" },
  ]
};

export const CORE_FLEXION_BLOCK: WorkoutBlock = {
  title: "Aesthetic Core Circuit (Spine Flexion)",
  exercises: [
    { name: "Hanging Leg Raises", sets: 1, baseReps: "10" },
    { name: "Reverse Crunches", sets: 3, baseReps: "15" },
    { name: "Bicycle Crunches", sets: 3, baseReps: "20" },
    { name: "Ring Knee Tucks", sets: 3, baseReps: "10" },
    { name: "V-Ups", sets: 3, baseReps: "15" },
    { name: "Hollow Body Hold", sets: 2, baseReps: "30", unit: "seconds" },
  ]
};

export const CORE_NO_FLEXION_BLOCK: WorkoutBlock = {
  title: "Aesthetic Core Circuit (No Flexion)",
  exercises: [
    { name: "Ab Rollout", sets: 3, baseReps: "15" },
    { name: "Bird Dog", sets: 3, baseReps: "15" },
    { name: "Deadbug", sets: 3, baseReps: "15" },
    { name: "Flutter Kicks", sets: 3, baseReps: "45", unit: "seconds" },
    { name: "Renegade Row", sets: 3, baseReps: "16" },
  ]
};

export const CHEST_ARMS_SHOULDERS_BLOCK: WorkoutBlock = {
  title: "Chest, Arms, & Shoulders",
  exercises: [
    { name: "Pushups", sets: 3, baseReps: "10" },
    { name: "Shoulder Press", sets: 2, baseReps: "9" },
    { name: "Dumbbell Pullover", sets: 3, baseReps: "9" },
    { name: "Dips (Bench or Chest)", sets: 3, baseReps: "12" },
    { name: "Bicep/Hammer Curls", sets: 2, baseReps: "13" },
  ]
};

export const LEG_FOUNDATION_BLOCK: WorkoutBlock = {
  title: "The Leg Foundation",
  exercises: [
    { name: "Hip Thrust", sets: 3, baseReps: "11" },
    { name: "Good Mornings", sets: 3, baseReps: "17" },
    { name: "Bulgarian Split Squats", sets: 3, baseReps: "13" },
    { name: "Calf Raises", sets: 2, baseReps: "17" },
    { name: "Burpees or Jump Squats", sets: 2, baseReps: "11" },
  ]
};
