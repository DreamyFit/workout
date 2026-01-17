
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateCalendarForRange } from './utils';
import { DailyWorkout, WeekType, CardioMode, WorkoutBlock, Exercise } from './types';

// Extended type for internal tracking to maintain identity through edits
interface ExtendedExercise extends Exercise {
  originalName: string;
}

// Local helper type for blocks with extended exercises
interface ExtendedWorkoutBlock {
  title: string;
  exercises: ExtendedExercise[];
}

const MUSCLE_COLORS: Record<string, string> = {
  'CAS': 'bg-[#e29578]',      // Peach
  'Back': 'bg-[#457b9d]',     // Steel Blue
  'Lower': 'bg-[#606c38]',    // Deep Olive
  'Core': 'bg-[#af8d99]',     // Mauve
};

const CARDIO_COLORS: Record<string, string> = {
  [CardioMode.Aerobic]: 'bg-[#e9c46a]',   // Gold/Yellow
  [CardioMode.Anaerobic]: 'bg-[#ff0000]', // Pure Red
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const Diamond: React.FC<{ className?: string, colorClass: string }> = ({ className, colorClass }) => (
  <div className={`rotate-45 shrink-0 ${colorClass} ${className} shadow-sm transition-transform`}></div>
);

interface ScheduleHistoryItem {
  targetBlocks: ExtendedWorkoutBlock[];
  sourceBlocks: ExtendedWorkoutBlock[];
  sourceKey: string;
}

interface DeletedExercise {
  ex: ExtendedExercise;
  originalIndex: number;
}

const App: React.FC = () => {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global Routine Customization
  const [globalModifications, setGlobalModifications] = useState<Record<string, Partial<Exercise>>>({});
  const [globalDeletions, setGlobalDeletions] = useState<string[]>([]);

  // Split History Management
  const [scheduleHistory, setScheduleHistory] = useState<Record<string, ScheduleHistoryItem>>({});
  
  // Track "Soft Deleted" items locally for immediate restoration UI
  const [deletedItemsThisSession, setDeletedItemsThisSession] = useState<Record<string, { blocks: ExtendedWorkoutBlock[], exercises: Record<number, DeletedExercise[]> }>>({});

  // Move / Combine State
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
  const [moveSourceBlockIndex, setMoveSourceBlockIndex] = useState<number | null>(null);
  const [moveConfirmTargetId, setMoveConfirmTargetId] = useState<string | null>(null);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const [timerPosition, setTimerPosition] = useState({ x: window.innerWidth - 80, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const timerStartPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Editing State
  const [editingExKey, setEditingExKey] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Partial<ExtendedExercise>>({});

  const [todayMidnight, setTodayMidnight] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});
  const [skippedDays, setSkippedDays] = useState<Record<string, boolean>>({});
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  // Update workoutOverrides state to use the extended block type
  const [workoutOverrides, setWorkoutOverrides] = useState<Record<string, ExtendedWorkoutBlock[]>>({});
  const [cardioOverrides, setCardioOverrides] = useState<Record<string, CardioMode | null>>({});

  useEffect(() => {
    const saved = {
      completed: localStorage.getItem('workout_completed'),
      skipped: localStorage.getItem('workout_skipped'),
      overrides: localStorage.getItem('workout_overrides'),
      cardio: localStorage.getItem('workout_cardio_overrides'),
      notes: localStorage.getItem('workout_notes'),
      globalMods: localStorage.getItem('workout_global_mods'),
      globalDels: localStorage.getItem('workout_global_dels'),
    };
    
    if (saved.completed) setCompletedDays(JSON.parse(saved.completed));
    if (saved.skipped) setSkippedDays(JSON.parse(saved.skipped));
    if (saved.overrides) setWorkoutOverrides(JSON.parse(saved.overrides));
    if (saved.cardio) setCardioOverrides(JSON.parse(saved.cardio));
    if (saved.notes) setDayNotes(JSON.parse(saved.notes));
    if (saved.globalMods) setGlobalModifications(JSON.parse(saved.globalMods));
    if (saved.globalDels) setGlobalDeletions(JSON.parse(saved.globalDels));
  }, []);

  useEffect(() => { localStorage.setItem('workout_completed', JSON.stringify(completedDays)); }, [completedDays]);
  useEffect(() => { localStorage.setItem('workout_skipped', JSON.stringify(skippedDays)); }, [skippedDays]);
  useEffect(() => { localStorage.setItem('workout_overrides', JSON.stringify(workoutOverrides)); }, [workoutOverrides]);
  useEffect(() => { localStorage.setItem('workout_cardio_overrides', JSON.stringify(cardioOverrides)); }, [cardioOverrides]);
  useEffect(() => { localStorage.setItem('workout_notes', JSON.stringify(dayNotes)); }, [dayNotes]);
  useEffect(() => { localStorage.setItem('workout_global_mods', JSON.stringify(globalModifications)); }, [globalModifications]);
  useEffect(() => { localStorage.setItem('workout_global_dels', JSON.stringify(globalDeletions)); }, [globalDeletions]);

  const baseSchedule = useMemo(() => generateCalendarForRange(2026, 0, 12), []);

  const fullSchedule = useMemo(() => {
    return baseSchedule.map(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      
      // Compute "Global Routine" for this day before checking overrides
      // Explicitly type blocks to ensure compatibility with ExtendedWorkoutBlock[]
      let blocks: ExtendedWorkoutBlock[] = day.blocks.map(block => ({
        ...block,
        exercises: block.exercises
          .filter(ex => !globalDeletions.includes(ex.name))
          .map(ex => {
            const mod = globalModifications[ex.name];
            // Ensure originalName is always attached for identity tracking
            return { ...ex, ...mod, originalName: ex.name } as ExtendedExercise;
          })
      })).filter(block => block.exercises.length > 0);

      // Local overrides take priority over global modifications for a specific day
      // workoutOverrides now uses ExtendedWorkoutBlock[] which matches the inferred type of blocks
      if (workoutOverrides[dateKey] !== undefined) {
        blocks = workoutOverrides[dateKey];
      }

      let cardio = day.cardio;
      if (cardioOverrides[dateKey] !== undefined) cardio = cardioOverrides[dateKey];
      
      return { ...day, blocks, cardio };
    });
  }, [baseSchedule, workoutOverrides, cardioOverrides, globalModifications, globalDeletions]);

  const activeMonthDays = useMemo(() => 
    fullSchedule.filter(d => d.date.getMonth() === currentMonth), 
  [fullSchedule, currentMonth]);

  const paddingDays = Array(activeMonthDays.length > 0 ? activeMonthDays[0].date.getDay() : 0).fill(null);
  
  const selectedDay = useMemo(() => 
    fullSchedule.find(d => d.date.toISOString() === selectedDayId) || null,
  [fullSchedule, selectedDayId]);

  const moveSourceDay = useMemo(() => 
    fullSchedule.find(d => d.date.toISOString() === moveSourceId) || null,
  [fullSchedule, moveSourceId]);

  // Helper to get the "Base + Global" blocks for comparison (the blocks WITHOUT local overrides)
  const baseDayBlocks = useMemo(() => {
    if (!selectedDayId) return [];
    const baseDay = baseSchedule.find(d => d.date.toISOString() === selectedDayId);
    if (!baseDay) return [];
    return baseDay.blocks.map(block => ({
      ...block,
      exercises: block.exercises
        .filter(ex => !globalDeletions.includes(ex.name))
        .map(ex => {
          const mod = globalModifications[ex.name];
          return { ...ex, ...mod, originalName: ex.name } as ExtendedExercise;
        })
    })).filter(block => block.exercises.length > 0);
  }, [selectedDayId, baseSchedule, globalModifications, globalDeletions]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isTimerActive) {
      interval = window.setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => interval && clearInterval(interval);
  }, [isTimerActive]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartPos.current = { x: clientX, y: clientY };
    timerStartPos.current = { ...timerPosition };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const dx = clientX - dragStartPos.current.x;
      const dy = clientY - dragStartPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;
      setTimerPosition({
        x: Math.max(10, Math.min(window.innerWidth - 80, timerStartPos.current.x + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 80, timerStartPos.current.y + dy))
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const getDotsForDay = (day: DailyWorkout) => {
    const groups = new Set<string>();
    day.blocks.forEach(b => {
      const t = b.title.toLowerCase();
      if (t.includes('cas') || t.includes('chest') || t.includes('arms') || t.includes('shoulder')) groups.add('CAS');
      else if (t.includes('back') || t.includes('posture')) groups.add('Back');
      else if (t.includes('lower') || t.includes('leg') || t.includes('foundation')) groups.add('Lower');
      else if (t.includes('core')) groups.add('Core');
    });
    return Array.from(groups);
  };

  const toggleComplete = (dateIso: string) => {
    const key = dateIso.split('T')[0];
    const isNowDone = !completedDays[key];
    setCompletedDays(prev => ({ ...prev, [key]: isNowDone }));
    if (isNowDone) setSkippedDays(prev => ({ ...prev, [key]: false }));
  };

  const setCardioFocus = (dateIso: string, mode: CardioMode | null) => {
    const key = dateIso.split('T')[0];
    setCardioOverrides(prev => ({ ...prev, [key]: mode }));
  };

  const executeMoveOrMerge = (type: 'move' | 'merge') => {
    if (!moveSourceDay || !moveConfirmTargetId) return;
    
    const sourceKey = moveSourceDay.date.toISOString().split('T')[0];
    const targetKey = moveConfirmTargetId.split('T')[0];
    const targetDay = fullSchedule.find(d => d.date.toISOString().split('T')[0] === targetKey);

    setScheduleHistory(prev => ({ 
      ...prev, 
      [targetKey]: {
        targetBlocks: JSON.parse(JSON.stringify(targetDay?.blocks || [])),
        sourceBlocks: JSON.parse(JSON.stringify(moveSourceDay.blocks)),
        sourceKey: sourceKey
      }
    }));

    const blocksToTransfer = moveSourceBlockIndex !== null 
      ? [moveSourceDay.blocks[moveSourceBlockIndex]]
      : moveSourceDay.blocks;

    const remainingBlocksInSource = moveSourceBlockIndex !== null
      ? moveSourceDay.blocks.filter((_, idx) => idx !== moveSourceBlockIndex)
      : [];

    setWorkoutOverrides(prev => {
      const next = { ...prev };
      if (type === 'move') {
        next[targetKey] = JSON.parse(JSON.stringify(blocksToTransfer));
      } else {
        const existingBlocks = targetDay?.blocks || [];
        next[targetKey] = [...JSON.parse(JSON.stringify(existingBlocks)), ...JSON.parse(JSON.stringify(blocksToTransfer))];
      }
      next[sourceKey] = JSON.parse(JSON.stringify(remainingBlocksInSource));
      return next;
    });

    setMoveSourceId(null);
    setMoveSourceBlockIndex(null);
    setMoveConfirmTargetId(null);
    setSelectedDayId(null);
  };

  const undoScheduleAction = (dateKey: string) => {
    const historyItem = scheduleHistory[dateKey];
    if (historyItem) {
      setWorkoutOverrides(prev => {
        const next = { ...prev };
        next[dateKey] = historyItem.targetBlocks;
        next[historyItem.sourceKey] = historyItem.sourceBlocks;
        return next;
      });
      setScheduleHistory(prev => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
    }
  };

  const undoExerciseChangeForName = (dateKey: string, originalName: string) => {
    if (!selectedDay) return;

    setWorkoutOverrides(prev => {
      const next = { ...prev };
      // Explicitly type currentBlocks as ExtendedWorkoutBlock[]
      const currentBlocks: ExtendedWorkoutBlock[] = JSON.parse(JSON.stringify(next[dateKey] || selectedDay.blocks));
      
      // Find the base version of the exercise from the core routine logic
      const baseDay = baseSchedule.find(d => d.date.toISOString().split('T')[0] === dateKey);
      if (!baseDay) return prev;
      const baseEx = baseDay.blocks.flatMap(b => b.exercises).find(e => e.name === originalName);
      if (!baseEx) return prev;

      const newBlocks = currentBlocks.map(b => ({
        ...b,
        exercises: b.exercises.map(e => {
           // Restore if current name OR originalName matches (handles name changes)
           return (e.originalName === originalName || e.name === originalName) ? { ...baseEx, originalName } as ExtendedExercise : e;
        })
      }));
      
      next[dateKey] = newBlocks;
      return next;
    });
  };

  const deleteExercise = (dateKey: string, blockIdx: number, exIdx: number, global: boolean = false) => {
    if (!selectedDay) return;
    const currentBlocks = JSON.parse(JSON.stringify(selectedDay.blocks));
    const exercise = currentBlocks[blockIdx].exercises[exIdx] as ExtendedExercise;

    if (global) {
      if (window.confirm(`Remove "${exercise.name}" from all days?`)) {
        setGlobalDeletions(prev => [...prev, exercise.name]);
      }
    } else {
      setDeletedItemsThisSession(prev => {
        const dayDel = prev[dateKey] || { blocks: [], exercises: {} };
        const blockExes = dayDel.exercises[blockIdx] || [];
        return {
          ...prev,
          [dateKey]: { ...dayDel, exercises: { ...dayDel.exercises, [blockIdx]: [...blockExes, { ex: exercise, originalIndex: exIdx }] } }
        };
      });

      const newBlocks = currentBlocks.map((b: ExtendedWorkoutBlock, bIdx: number) => {
        if (bIdx !== blockIdx) return b;
        return { ...b, exercises: b.exercises.filter((_, i) => i !== exIdx) };
      }).filter((b: ExtendedWorkoutBlock) => b.exercises.length > 0);
      setWorkoutOverrides(prev => ({ ...prev, [dateKey]: newBlocks }));
    }
  };

  const deleteBlock = (dateKey: string, blockIdx: number) => {
    if (!selectedDay) return;
    setDeletedItemsThisSession(prev => {
      const dayDel = prev[dateKey] || { blocks: [], exercises: {} };
      return {
        ...prev,
        [dateKey]: { ...dayDel, blocks: [...dayDel.blocks, selectedDay.blocks[blockIdx]] }
      };
    });

    const newBlocks = selectedDay.blocks.filter((_, idx) => idx !== blockIdx);
    setWorkoutOverrides(prev => ({ ...prev, [dateKey]: newBlocks }));
  };

  const saveExerciseEdit = (dateKey: string, blockIdx: number, exIdx: number, applyToAll: boolean) => {
    if (!selectedDay) return;
    
    const exercise = selectedDay.blocks[blockIdx].exercises[exIdx];
    // We must use originalName to correctly key the globalModifications map
    const key = exercise.originalName;
    
    // Cleanup numerical inputs to avoid NaN
    const cleanBuffer = { ...editBuffer };
    if (cleanBuffer.sets !== undefined && isNaN(cleanBuffer.sets)) cleanBuffer.sets = exercise.sets;

    const updatedEx = { ...exercise, ...cleanBuffer } as ExtendedExercise;

     const newBlocks: ExtendedWorkoutBlock[] = JSON.parse(JSON.stringify(selectedDay.blocks));
      newBlocks[blockIdx].exercises[exIdx] = updatedEx;
      setWorkoutOverrides(prev => ({ ...prev, [dateKey]: newBlocks }));

    if (applyToAll) {
      setGlobalModifications(prev => ({ ...prev, [key]: updatedEx }));
      // If we applied globally, we might want to clear any specific local override for this day to keep it synced
     
    }
    
    setEditingExKey(null);
    setEditBuffer({});
  };

  const restoreSoftDeletedBlock = (dateKey: string, block: ExtendedWorkoutBlock) => {
    setWorkoutOverrides(prev => {
      const current = prev[dateKey] || [];
      return { ...prev, [dateKey]: [...current, block] };
    });
    setDeletedItemsThisSession(prev => {
      const next = { ...prev };
      next[dateKey].blocks = next[dateKey].blocks.filter(b => b.title !== block.title);
      return next;
    });
  };

  const restoreSoftDeletedExercise = (dateKey: string, blockIdx: number, deleted: DeletedExercise) => {
    setWorkoutOverrides(prev => {
      const current = [...(prev[dateKey] || selectedDay?.blocks || [])];
      if (current[blockIdx]) {
        const nextExes = [...current[blockIdx].exercises];
        nextExes.splice(deleted.originalIndex, 0, deleted.ex);
        current[blockIdx] = { ...current[blockIdx], exercises: nextExes };
      }
      return { ...prev, [dateKey]: current };
    });
    setDeletedItemsThisSession(prev => {
      const next = { ...prev };
      const blockExes = next[dateKey].exercises[blockIdx].filter(d => d.ex.name !== deleted.ex.name);
      next[dateKey].exercises[blockIdx] = blockExes;
      return next;
    });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev - 1 + 12) % 12);
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => (prev + 1) % 12);
  };

  return (
    <div className="relative min-h-screen max-w-5xl mx-auto px-4 py-12 text-[#4a3f44] overflow-x-hidden">
      
      {moveSourceId && (
        <div className="fixed inset-x-0 top-0 z-[120] bg-[#af8d99] text-white p-6 text-center shadow-2xl animate-in slide-in-from-top flex flex-col items-center gap-3">
           <div className="flex items-center gap-4">
              <i className="fa-solid fa-wand-magic-sparkles text-xl animate-pulse"></i>
              <p className="text-[11px] font-bold uppercase tracking-[0.4em]">Selection Mode: Choose a destination day on the calendar</p>
           </div>
           <button onClick={() => { setMoveSourceId(null); setMoveSourceBlockIndex(null); }} className="px-8 py-2 bg-white/20 hover:bg-white/40 border border-white/30 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all">Cancel Move Operation</button>
        </div>
      )}

      {/* Floating Timer */}
      <div className="fixed z-[60] select-none touch-none" style={{ left: `${timerPosition.x}px`, top: `${timerPosition.y}px` }} onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}>
        <div className={`flex flex-row-reverse items-center gap-3 bg-[#faf5f7] backdrop-blur-xl border border-[#e5d5da] shadow-2xl shadow-rose-900/10 ${isTimerExpanded ? 'rounded-2xl px-5 py-3.5' : 'rounded-full p-3.5 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform'}`} onClick={() => !hasMoved.current && !isTimerExpanded && setIsTimerExpanded(true)}>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#af8d99] text-white shrink-0 shadow-lg shadow-[#af8d99]/30">
            <i className={`fa-solid ${isTimerActive ? 'fa-hourglass-half fa-spin' : 'fa-stopwatch'}`}></i>
          </div>
          {isTimerExpanded && (
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-2 border-r border-[#af8d99]/10 pr-4">
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsTimerExpanded(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#cbb9bf] hover:text-[#af8d99] hover:bg-[#af8d99]/10 transition-all"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsTimerActive(false); setTimerSeconds(0); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f3eded] text-[#b3a3a9] transition-all"><i className="fa-solid fa-rotate-left text-[10px]"></i></button>
                <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsTimerActive(!isTimerActive); }} className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${isTimerActive ? 'bg-[#e29578] text-white' : 'bg-[#af8d99]/10 text-[#af8d99]'}`}><i className={`fa-solid ${isTimerActive ? 'fa-pause' : 'fa-play'} text-[10px]`}></i></button>
              </div>
              <span className="text-xl font-bold text-[#af8d99] font-mono tabular-nums">{formatTime(timerSeconds)}</span>
            </div>
          )}
        </div>
      </div>

      {moveConfirmTargetId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-[#4a3f44]/60 backdrop-blur-md">
          <div className="bg-[#faf5f7] w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center space-y-6 border border-[#e5d5da] animate-in zoom-in-95">
            <div className="w-16 h-16 bg-[#af8d99]/10 text-[#af8d99] rounded-full flex items-center justify-center mx-auto text-2xl">
              <i className="fa-solid fa-shuffle"></i>
            </div>
            <h3 className="text-xl font-light uppercase tracking-widest text-[#af8d99]">Finalize Schedule</h3>
            <p className="text-sm text-[#8e7d7d] leading-relaxed">
              Transferring to <strong>{new Date(moveConfirmTargetId).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>.
              <br/><span className="text-[10px] opacity-60">This will move content from the selected source day.</span>
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <button onClick={() => executeMoveOrMerge('move')} className="w-full py-4 bg-[#af8d99] text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#af8d99]/20">
                Overwrite Destination (Move)
              </button>
              <button onClick={() => executeMoveOrMerge('merge')} className="w-full py-4 border-2 border-[#af8d99] text-[#af8d99] rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#af8d99]/5 active:scale-95 transition-all">
                Add to Destination (Merge)
              </button>
              <button onClick={() => setMoveConfirmTargetId(null)} className="w-full py-4 text-[#b3a3a9] text-[10px] font-bold uppercase tracking-widest hover:text-[#4a3f44] transition-colors">
                Change Destination
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col items-center mb-16 gap-10 text-center relative">
        <h1 className="text-5xl font-light text-[#9d8189] tracking-[0.3em] uppercase drop-shadow-sm">Bloom & Build</h1>
        
        {/* Muscle Color Legend (The Key) */}
        <div className="flex flex-wrap justify-center gap-6 mt-4">
          {Object.entries(MUSCLE_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <Diamond className="w-2 h-2" colorClass={color} />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8e7d7d]">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrevMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#faf5f7] border border-[#e5d5da] text-[#af8d99] shadow-sm hover:scale-110 active:scale-95 transition-all"
            title="Previous Month"
          >
            <i className="fa-solid fa-chevron-left text-[10px]"></i>
          </button>

          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} className="flex items-center gap-6 bg-[#faf5f7] border border-[#e5d5da] px-10 py-3.5 rounded-full shadow-lg text-[11px] font-bold tracking-[0.3em] uppercase text-[#9d8189] transition-all">
              {MONTHS[currentMonth]}
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-500 ${isMonthDropdownOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {isMonthDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-72 bg-[#faf5f7] backdrop-blur-xl rounded-[2rem] shadow-2xl border border-[#e5d5da] overflow-hidden z-[70]">
                {MONTHS.map((name, idx) => (
                  <button key={name} onClick={() => { setCurrentMonth(idx); setIsMonthDropdownOpen(false); }} className={`w-full px-8 py-4 text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${currentMonth === idx ? 'bg-[#af8d99] text-white' : 'text-[#8e7d7d] hover:bg-[#af8d99]/5 hover:text-[#af8d99]'}`}>{name}</button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={handleNextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#faf5f7] border border-[#e5d5da] text-[#af8d99] shadow-sm hover:scale-110 active:scale-95 transition-all"
            title="Next Month"
          >
            <i className="fa-solid fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 gap-4 md:gap-8 bg-white p-4 md:p-14 rounded-[3.5rem] shadow-2xl shadow-[#af8d99]/20 border border-[#e5d5da] relative overflow-hidden transition-all duration-700 ${moveSourceId ? 'ring-8 ring-[#af8d99]/20' : ''}`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[#c4b5b5] font-bold text-[10px] uppercase tracking-[0.4em] mb-6">{d}</div>
        ))}
        {paddingDays.map((_, i) => <div key={`pad-${i}`} className="aspect-square opacity-0"></div>)}
        {activeMonthDays.map((day) => {
          const dots = getDotsForDay(day);
          const dateKey = day.date.toISOString().split('T')[0];
          const isMoving = moveSourceId === day.date.toISOString();
          const isToday = day.date.getTime() === todayMidnight.getTime();
          const isRestDay = dots.length === 0 && !day.cardio;
          
          return (
            <button 
              key={day.date.toISOString()} 
              onClick={() => moveSourceId ? setMoveConfirmTargetId(day.date.toISOString()) : setSelectedDayId(day.date.toISOString())}
              className={`relative aspect-square p-1.5 md:p-4 rounded-[2rem] border transition-all duration-500 flex flex-col items-center justify-center group
                ${day.date.getTime() < todayMidnight.getTime() ? 'bg-[#ebdce2] border-[#c4b5b5]' : 'bg-[#faf7f9] border-[#e5d5da]'}
                ${isToday ? 'border-[3px] border-[#1a1617] scale-105 z-10' : 'hover:scale-105'}
                ${isMoving ? 'ring-4 ring-[#af8d99] scale-110 shadow-2xl bg-white animate-pulse' : ''}
                ${moveSourceId && !isMoving ? 'hover:ring-4 hover:ring-[#af8d99]/40 hover:scale-110 cursor-pointer' : ''}
                ${skippedDays[dateKey] ? 'opacity-40 grayscale-[0.8]' : ''}`}
            >
              <div className="absolute top-2 left-2 md:top-4 md:left-4 flex items-center gap-1 z-10">
                <span className={`text-[10px] md:text-[12px] font-bold ${moveSourceId && !isMoving ? 'text-[#af8d99]' : ''}`}>{day.date.getDate()}</span>
                {completedDays[dateKey] && <i className="fa-solid fa-circle-check text-[11px] text-[#af8d99]"></i>}
              </div>
              <div className="flex flex-wrap justify-center gap-1 md:gap-3 w-full mt-3 px-1">
                {isRestDay ? (
                  <div className="flex flex-col items-center gap-1 opacity-20 group-hover:opacity-40 transition-opacity">
                    <i className="fa-solid fa-leaf text-lg md:text-2xl text-[#af8d99]"></i>
                  </div>
                ) : (
                  dots.map((group, idx) => <Diamond key={idx} className="w-1 h-1 md:w-2 md:h-2" colorClass={MUSCLE_COLORS[group]} />)
                )}
              </div>
              {day.cardio && <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4"><Diamond className="w-1 h-1 md:w-2 md:h-2" colorClass={CARDIO_COLORS[day.cardio]} /></div>}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#4a3f44]/40 backdrop-blur-xl">
          <div className="bg-[#fdf3f6] w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-[#e5d5da] flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-12 duration-500">
            <div className={`p-10 shrink-0 ${skippedDays[selectedDay.date.toISOString().split('T')[0]] ? 'bg-[#8d99af]' : 'bg-[#af8d99]'} text-white relative transition-colors`}>
              <h2 className="text-3xl font-light tracking-[0.2em] uppercase">{selectedDay.dayName}</h2>
              <div className="flex items-center gap-4 mt-3">
                <p className="text-[11px] font-bold opacity-80 uppercase tracking-[0.3em]">
                  {selectedDay.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} • {selectedDay.weekType}
                </p>
                {scheduleHistory[selectedDay.date.toISOString().split('T')[0]] && (
                  <button onClick={() => undoScheduleAction(selectedDay.date.toISOString().split('T')[0])} className="px-3 py-1 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all">
                    <i className="fa-solid fa-rotate-left"></i> Undo Move/Merge (Restores Both Days)
                  </button>
                )}
              </div>
              <button onClick={() => { setSelectedDayId(null); setEditingExKey(null); }} className="absolute top-10 right-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all group">
                <i className="fa-solid fa-xmark text-lg group-hover:rotate-90 transition-transform"></i>
              </button>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto space-y-12 custom-scrollbar bg-[#faf5f7]">
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setMoveSourceId(selectedDay.date.toISOString()); setMoveSourceBlockIndex(null); setSelectedDayId(null); }} 
                  className="w-full py-4 bg-white border border-[#e5d5da] text-[#af8d99] text-[10px] font-bold uppercase tracking-[0.25em] rounded-[1.5rem] flex items-center justify-center gap-3 hover:bg-[#af8d99] hover:text-white transition-all shadow-sm active:scale-95"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Move or Merge Whole Day
                </button>
              </div>

              {/* Cardio Tracker (Moved to Top) */}
              <div className="space-y-4">
                <h3 className="text-[#8e7d7d] font-bold uppercase tracking-[0.3em] text-[10px]">Cardio Focus</h3>
                <div className="flex gap-3">
                  {[CardioMode.Aerobic, CardioMode.Anaerobic, null].map((mode) => (
                    <button
                      key={mode || 'rest'}
                      onClick={() => setCardioFocus(selectedDay.date.toISOString(), mode)}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest border-2 transition-all ${
                        selectedDay.cardio === mode
                          ? (mode === CardioMode.Aerobic ? 'bg-[#e9c46a] border-[#e9c46a] text-white' : 
                             mode === CardioMode.Anaerobic ? 'bg-[#ff0000] border-[#ff0000] text-white' : 
                             'bg-[#4a3f44] border-[#4a3f44] text-white')
                          : 'border-[#e5d5da] text-[#b3a3a9] hover:border-[#af8d99]/40'
                      }`}
                    >
                      {mode === CardioMode.Aerobic ? 'Aerobic' : mode === CardioMode.Anaerobic ? 'Anaerobic' : 'Rest'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <h3 className="text-[#8e7d7d] font-bold uppercase tracking-[0.3em] text-[10px]">Your Routine</h3>

                {selectedDay.blocks.length > 0 ? selectedDay.blocks.map((block, bIdx) => {
                  const dateKey = selectedDay.date.toISOString().split('T')[0];
                  return (
                    <div key={bIdx} className="space-y-6 animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${bIdx * 100}ms` }}>
                      <div className="flex justify-between items-center px-4">
                        <h4 className="text-[#af8d99] font-bold uppercase tracking-[0.3em] text-[11px]">{block.title}</h4>
                        <div className="flex gap-2">
                          <button 
                            title="Move this section"
                            onClick={() => { setMoveSourceId(selectedDay.date.toISOString()); setMoveSourceBlockIndex(bIdx); setSelectedDayId(null); }} 
                            className="w-8 h-8 flex items-center justify-center bg-[#af8d99]/10 text-[#af8d99] rounded-full hover:bg-[#af8d99] hover:text-white transition-all shadow-sm active:scale-90"
                          >
                            <i className="fa-solid fa-arrow-right-arrow-left text-[9px]"></i>
                          </button>
                          <button 
                            title="Remove section"
                            onClick={() => deleteBlock(dateKey, bIdx)} 
                            className="w-8 h-8 flex items-center justify-center bg-red-100/50 text-red-400 rounded-full hover:bg-red-400 hover:text-white transition-all shadow-sm active:scale-90"
                          >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {block.exercises.map((ex, eIdx) => {
                          const exKey = `${bIdx}-${eIdx}`;
                          const isEditing = editingExKey === exKey;
                          
                          // Look up the "original" exercise from the core routine
                          const baseExForRef = baseDayBlocks.flatMap(b => b.exercises).find(e => e.originalName === ex.originalName);
                          const hasLocalEdits = baseExForRef && (ex.sets !== baseExForRef.sets || ex.baseReps !== baseExForRef.baseReps || ex.name !== baseExForRef.name);
                          const isEditedGlobally = !!globalModifications[ex.originalName];

                          return (
                            <div key={eIdx} className="bg-white p-6 rounded-[1.5rem] border border-[#e5d5da] hover:border-[#af8d99]/20 transition-all group shadow-sm">
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  {isEditing ? (
                                    <input 
                                      className="bg-transparent border-b-2 border-[#af8d99] text-sm font-bold text-[#6d5b62] focus:outline-none w-full" 
                                      value={editBuffer.name ?? ex.name} 
                                      onChange={e => setEditBuffer(p => ({ ...p, name: e.target.value }))} 
                                      autoFocus 
                                    />
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <span className="font-bold text-[#6d5b62] text-sm tracking-tight">{ex.name}</span>
                                      {(hasLocalEdits || isEditedGlobally) && (
                                        <button 
                                          onClick={() => {
                                            if (isEditedGlobally) {
                                               setGlobalModifications(prev => { 
                                                 const next = {...prev}; 
                                                 delete next[ex.originalName]; 
                                                 return next; 
                                               });
                                            } else {
                                               undoExerciseChangeForName(dateKey, ex.originalName);
                                            }
                                          }} 
                                          className="w-6 h-6 rounded-full bg-[#af8d99]/10 text-[#af8d99] hover:bg-[#af8d99] hover:text-white flex items-center justify-center transition-all animate-in zoom-in" 
                                          title="Undo detail changes for this exercise"
                                        >
                                          <i className="fa-solid fa-rotate-left text-[8px]"></i>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center gap-3">
                                    {isEditing ? (
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          className="w-12 bg-transparent border-b border-[#af8d99] text-[10px] font-bold" 
                                          value={editBuffer.sets ?? ex.sets} 
                                          onChange={e => setEditBuffer(p => ({ ...p, sets: parseInt(e.target.value) }))} 
                                        />
                                        <span className="text-[10px] text-[#b3a3a9] font-bold uppercase tracking-widest">Sets</span>
                                      </div>
                                    ) : (
                                      <span className="text-[12px] text-[#af8d99] font-black">{ex.sets}<span className="text-[9px] text-[#b3a3a9] font-bold ml-1 uppercase">Sets</span></span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-6">
                                  {isEditing ? (
                                    <input 
                                      className="w-14 text-center bg-transparent border-b-2 border-[#af8d99] text-sm font-bold text-[#af8d99]" 
                                      value={editBuffer.baseReps ?? ex.baseReps} 
                                      onChange={e => setEditBuffer(p => ({ ...p, baseReps: e.target.value }))} 
                                    />
                                  ) : (
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-xl font-bold text-[#af8d99] tabular-nums">{ex.baseReps}</span>
                                      <span className="text-[9px] text-[#b3a3a9] font-bold uppercase">{ex.unit || 'reps'}</span>
                                    </div>
                                  )}
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    {!isEditing ? (
                                      <>
                                        <button onClick={() => { setEditingExKey(exKey); setEditBuffer(ex); }} className="w-8 h-8 rounded-full bg-[#af8d99]/10 text-[#af8d99] hover:bg-[#af8d99] hover:text-white flex items-center justify-center transition-all shadow-sm"><i className="fa-solid fa-pen text-[9px]"></i></button>
                                        <button onClick={() => deleteExercise(dateKey, bIdx, eIdx, false)} className="w-8 h-8 rounded-full bg-red-100 text-red-400 hover:bg-red-400 hover:text-white flex items-center justify-center transition-all shadow-sm"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                                      </>
                                    ) : (
                                      <button onClick={() => setEditingExKey(null)} className="w-8 h-8 rounded-full bg-[#b3a3a9] text-white flex items-center justify-center transition-all"><i className="fa-solid fa-xmark"></i></button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isEditing && (
                                <div className="mt-6 flex gap-2 pt-4 border-t border-[#e5d5da]/50">
                                  <button onClick={() => saveExerciseEdit(dateKey, bIdx, eIdx, false)} className="px-4 py-2 bg-[#af8d99] text-white rounded-lg text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-transform shadow-md">Just Today</button>
                                  <button onClick={() => saveExerciseEdit(dateKey, bIdx, eIdx, true)} className="px-4 py-2 bg-[#e29578] text-white rounded-lg text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-transform shadow-md">Apply Globally</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {deletedItemsThisSession[dateKey]?.exercises?.[bIdx]?.map((deleted, i) => (
                          <div key={i} className="bg-white/40 border border-dashed border-[#e5d5da] p-4 rounded-[1.5rem] flex justify-between items-center animate-in fade-in zoom-in-95">
                            <span className="text-[10px] font-bold text-[#b3a3a9] uppercase tracking-widest italic">{deleted.ex.name} deleted</span>
                            <button onClick={() => restoreSoftDeletedExercise(dateKey, bIdx, deleted)} className="px-4 py-2 bg-[#af8d99] text-white text-[9px] font-bold uppercase tracking-widest rounded-full transition-transform active:scale-95 shadow-lg shadow-[#af8d99]/20">
                              <i className="fa-solid fa-rotate-left mr-2"></i> Restore Exercise
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-24 flex flex-col items-center animate-in fade-in zoom-in duration-700">
                    <div className="w-20 h-20 bg-[#af8d99]/5 rounded-full flex items-center justify-center mb-8 relative">
                      <i className="fa-solid fa-leaf text-4xl text-[#af8d99] opacity-40"></i>
                      <div className="absolute inset-0 rounded-full border border-[#af8d99]/10 animate-ping"></div>
                    </div>
                    <p className="font-light text-2xl text-[#af8d99] tracking-[0.2em] uppercase mb-3">Serenity & Stillness</p>
                    <p className="font-bold uppercase tracking-[0.4em] text-[9px] text-[#b3a3a9]">Your body is blooming in the quiet</p>
                  </div>
                )}
                
                {deletedItemsThisSession[selectedDay.date.toISOString().split('T')[0]]?.blocks.map((block, i) => (
                   <div key={i} className="bg-white/40 border border-dashed border-[#e5d5da] p-8 rounded-[2.5rem] flex flex-col items-center gap-4 animate-in fade-in zoom-in-95">
                      <p className="text-[10px] font-bold text-[#b3a3a9] uppercase tracking-widest italic">"{block.title}" Section Removed</p>
                      <button onClick={() => restoreSoftDeletedBlock(selectedDay.date.toISOString().split('T')[0], block)} className="px-8 py-3 bg-[#af8d99] text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full shadow-xl active:scale-95 transition-transform">
                        <i className="fa-solid fa-rotate-left mr-3"></i> Undo Section Removal
                      </button>
                   </div>
                ))}
              </div>

              <div className="space-y-4 pt-12">
                <h3 className="text-[#8e7d7d] font-bold uppercase tracking-[0.3em] text-[10px]">Day Reflection</h3>
                <textarea value={dayNotes[selectedDay.date.toISOString().split('T')[0]] || ''} onChange={e => setDayNotes(prev => ({ ...prev, [selectedDay.date.toISOString().split('T')[0]]: e.target.value }))} placeholder="Today felt..." className="w-full h-32 p-8 bg-[#faf5f7] rounded-[2rem] border border-[#e5d5da] text-sm text-[#6d5b62] focus:outline-none focus:ring-4 focus:ring-[#af8d99]/10 resize-none shadow-sm placeholder:opacity-40" />
              </div>
            </div>

            <div className="p-8 bg-[#faf5f7] flex flex-col sm:flex-row gap-4 border-t border-[#e5d5da]">
              <button onClick={() => toggleComplete(selectedDay.date.toISOString())} className={`flex-1 px-6 py-5 border-2 text-[10px] font-bold tracking-[0.3em] uppercase rounded-full transition-all duration-700 active:scale-95 ${completedDays[selectedDay.date.toISOString().split('T')[0]] ? 'border-[#af8d99] text-[#af8d99] bg-white' : 'bg-[#af8d99] text-white border-transparent shadow-xl shadow-[#af8d99]/20'}`}>
                {completedDays[selectedDay.date.toISOString().split('T')[0]] ? 'Mark Unfinished' : 'Complete Session'}
              </button>
              <button onClick={() => { setSkippedDays(prev => ({ ...prev, [selectedDay.date.toISOString().split('T')[0]]: !prev[selectedDay.date.toISOString().split('T')[0]] })); setSelectedDayId(null); }} className={`flex-1 px-6 py-5 border-2 text-[10px] font-bold tracking-[0.3em] uppercase rounded-full transition-all duration-700 active:scale-95 ${skippedDays[selectedDay.date.toISOString().split('T')[0]] ? 'border-[#8d99af] text-[#8d99af] bg-white' : 'bg-[#8d99af] text-white border-transparent'}`}>
                {skippedDays[selectedDay.date.toISOString().split('T')[0]] ? 'Recovered' : 'Skip Day'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-24 pb-12 flex flex-col items-center gap-8">
        <p className="font-bold uppercase tracking-[0.4em] text-[10px] text-[#b3a3a9]">Bloom & Build Planner • {fullSchedule.find(d => d.date.getTime() === todayMidnight.getTime())?.weekType || 'Active'} Split</p>
        <div className="flex gap-4">
           {globalDeletions.length > 0 && (
             <button onClick={() => setGlobalDeletions([])} className="px-6 py-2 border border-[#af8d99]/20 text-[#af8d99] text-[9px] font-bold uppercase tracking-widest rounded-full hover:bg-[#af8d99]/5 transition-colors">Restore Globally Deleted</button>
           )}
           <button onClick={() => { if(window.confirm("Start over with a fresh routine? This deletes all your custom changes.")) { localStorage.clear(); window.location.reload(); } }} className="px-6 py-2 text-[9px] font-bold text-[#b3a3a9] uppercase tracking-widest hover:text-[#4a3f44] transition-colors">Reset Entire Planner</button>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #af8d9960; border-radius: 20px; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
