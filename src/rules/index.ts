import type { Task } from '../types';
import type { RuleContext } from './context';
import { greenhouseTasks } from './greenhouse';
import { seasonalTasks } from './seasonal';
import { wateringTasks } from './watering';
import { weatherTasks } from './weather';

export type { RuleContext } from './context';

/**
 * Every job the garden could use today, most urgent first. Gemma turns the top few into
 * the day's plan; when Ollama is down, this list is the plan.
 */
export function candidateTasks(ctx: RuleContext): Task[] {
  return [
    ...weatherTasks(ctx),
    ...greenhouseTasks(ctx),
    ...wateringTasks(ctx),
    ...seasonalTasks(ctx),
  ].sort((a, b) => b.priority - a.priority);
}
