/** Public API of the learner feature, for use by other features. */
export { default as LearningCompanion, type CompanionState } from './components/LearningCompanion';
export { default as Celebration, type CelebrationData } from './components/Celebration';
export {
  MASTERY_DESCRIPTION,
  MASTERY_ICON,
  MASTERY_LABEL,
  MASTERY_TONE_CLASS,
  isMasteryState,
  masteryStateOf,
  type MasteryState,
} from './masteryDisplay';
