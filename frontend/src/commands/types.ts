import type { Annotation } from '../types/annotation';

/**
 * A command is a reversible mutation of the annotation store.
 *
 * - apply()   : perform the mutation (called on do and redo)
 * - invert()  : return the reverse command
 * - label     : human-readable, used for tooltips ("Undo move")
 * - coalesceWith: optional — merge consecutive commands into one
 *                (e.g. dragging a vertex 60 times = one "move vertex" command)
 */
export interface Command {
  label: string;
  apply(store: CommandContext): void;
  invert(): Command;
  coalesceWith?(next: Command): Command | null;
}

export interface CommandContext {
  annotations: Annotation[];
  addLocal: (a: Annotation) => void;
  removeLocal: (id: string) => void;
  replaceAnnotation: (id: string, patch: Partial<Annotation>) => void;
  replaceMany: (ids: string[], patch: Partial<Annotation>) => void;
  selectOne: (id: string | null) => void;
  selectMany: (ids: string[]) => void;
}
