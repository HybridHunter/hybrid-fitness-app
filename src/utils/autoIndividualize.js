/**
 * Auto-individualize a workout for a specific member based on their movement scores
 * and the movement matrix.
 *
 * @param {Object} workout - Saved workout with sections[].slots[].exercise
 * @param {Object} memberScores - Member's movementScores {Squat: -1, Hinge: 2, ...}
 * @param {Array} matrix - Array of chain objects from movementMatrix
 * @param {Array} exercises - Full exercise library array
 * @returns {Object} - New workout object with exercises swapped per member's level
 */
export function autoIndividualize(workout, memberScores, matrix, exercises) {
  if (!workout || !memberScores || !matrix || !exercises) return workout;

  const exByName = {};
  exercises.forEach(ex => { exByName[ex.n] = ex; });

  const newSections = workout.sections.map(sec => ({
    ...sec,
    slots: sec.slots.map(slot => {
      if (!slot.exercise) return slot;

      const ex = slot.exercise;
      const pattern = ex.p;
      const score = memberScores[pattern] || 0;

      // Find the best matching chain for this exercise
      const swapped = findSwappedExercise(ex, pattern, score, matrix, exByName);

      return {
        ...slot,
        exercise: swapped || ex,
        _originalExercise: ex,
        _memberScore: score,
        _wasSwapped: swapped && swapped.n !== ex.n,
      };
    }),
  }));

  return { ...workout, sections: newSections };
}

/**
 * Find the appropriate exercise swap for a given exercise, pattern, and score level.
 */
function findSwappedExercise(exercise, pattern, score, matrix, exByName) {
  // Find chains for this pattern
  const patternChains = matrix.filter(c => c.pattern === pattern);
  if (!patternChains.length) return null;

  // Find the chain that contains this exercise at any level
  let bestChain = null;
  let exerciseBaseLevel = null;

  for (const chain of patternChains) {
    for (const [level, name] of Object.entries(chain.levels)) {
      if (name === exercise.n) {
        bestChain = chain;
        exerciseBaseLevel = parseInt(level, 10);
        break;
      }
    }
    if (bestChain) break;
  }

  // If exercise isn't in any chain, keep the original exercise —
  // never substitute from an unrelated chain
  if (!bestChain) return null;

  // Calculate the target level based on member's score
  // The score IS the target level (member scored at -2 means they should do level -2 exercises)
  const targetLevel = clamp(score, -3, 3);

  // Find the exercise at the target level, or the closest available level
  const targetExName = findClosestLevel(bestChain.levels, targetLevel);
  if (!targetExName) return null;

  return exByName[targetExName] || null;
}

/**
 * Find the exercise at the target level, or the closest available level.
 */
function findClosestLevel(levels, target) {
  // Try exact level first
  if (levels[String(target)]) return levels[String(target)];

  // Search outward from target
  for (let offset = 1; offset <= 6; offset++) {
    if (levels[String(target + offset)]) return levels[String(target + offset)];
    if (levels[String(target - offset)]) return levels[String(target - offset)];
  }

  return null;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Get a summary of what changed for display purposes.
 */
export function getIndividualizationSummary(originalWorkout, individualizedWorkout) {
  const changes = [];

  if (!individualizedWorkout || !originalWorkout) return changes;

  individualizedWorkout.sections.forEach((sec, si) => {
    sec.slots.forEach((slot, idx) => {
      if (slot._wasSwapped && slot._originalExercise) {
        changes.push({
          sectionId: sec.id,
          slotIndex: idx,
          original: slot._originalExercise.n,
          swapped: slot.exercise.n,
          pattern: slot._originalExercise.p,
          score: slot._memberScore,
        });
      }
    });
  });

  return changes;
}
