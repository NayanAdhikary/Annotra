import type { Command, CommandContext } from './types';
import type { Annotation } from '../types/annotation';

// ---------- Add ----------

export class AddAnnotationCommand implements Command {
  label = 'Add annotation';
  private readonly ann: Annotation;
  constructor(ann: Annotation) { this.ann = ann; }

  apply(ctx: CommandContext): void {
    ctx.addLocal(this.ann);
    ctx.selectOne(this.ann.id);
  }

  invert(): Command {
    return new DeleteAnnotationCommand(this.ann);
  }
}

// ---------- Delete ----------

export class DeleteAnnotationCommand implements Command {
  label = 'Delete annotation';
  private readonly ann: Annotation;
  constructor(ann: Annotation) { this.ann = ann; }

  apply(ctx: CommandContext): void {
    ctx.removeLocal(this.ann.id);
  }

  invert(): Command {
    return new AddAnnotationCommand(this.ann);
  }
}

// ---------- Delete many (bulk) ----------

export class DeleteManyCommand implements Command {
  label = 'Delete annotations';
  private readonly anns: Annotation[];
  constructor(anns: Annotation[]) { this.anns = anns; }

  apply(ctx: CommandContext): void {
    for (const a of this.anns) ctx.removeLocal(a.id);
  }

  invert(): Command {
    return new AddManyCommand(this.anns);
  }
}

export class AddManyCommand implements Command {
  label = 'Restore annotations';
  private readonly anns: Annotation[];
  constructor(anns: Annotation[]) { this.anns = anns; }

  apply(ctx: CommandContext): void {
    for (const a of this.anns) ctx.addLocal(a);
  }

  invert(): Command {
    return new DeleteManyCommand(this.anns);
  }
}

// ---------- Change label (single or bulk) ----------

export class ChangeLabelCommand implements Command {
  label = 'Change label';
  private readonly ids: string[];
  private readonly fromLabelId: number;
  private readonly toLabelId: number;
  constructor(ids: string[], fromLabelId: number, toLabelId: number) {
    this.ids = ids;
    this.fromLabelId = fromLabelId;
    this.toLabelId = toLabelId;
  }

  apply(ctx: CommandContext): void {
    ctx.replaceMany(this.ids, { labelId: this.toLabelId });
  }

  invert(): Command {
    return new ChangeLabelCommand(this.ids, this.toLabelId, this.fromLabelId);
  }
}

// ---------- Move vertices / points (drag, resize, vertex edit) ----------

/**
 * The workhorse command. Covers: rectangle move, rectangle resize,
 * polygon vertex drag, points drag, polygon vertex insert/delete.
 * It's just "replace points[] from A to B" for a set of annotations.
 */
export class ReplacePointsCommand implements Command {
  label = 'Move annotation';
  private readonly changes: Array<{ id: string; from: number[]; to: number[]; }>;
  constructor(changes: Array<{ id: string; from: number[]; to: number[]; }>) {
    this.changes = changes;
  }

  apply(ctx: CommandContext): void {
    for (const c of this.changes) ctx.replaceAnnotation(c.id, { points: c.to });
  }

  invert(): Command {
    return new ReplacePointsCommand(
      this.changes.map((c) => ({ id: c.id, from: c.to, to: c.from })),
    );
  }

  /**
   * Coalesce consecutive drags of the same vertices into one command.
   * Only merges if the `to` of `this` matches the `from` of `next` for every
   * affected id — i.e. they are literally the same drag continuing.
   */
  coalesceWith(next: Command): Command | null {
    if (!(next instanceof ReplacePointsCommand)) return null;
    if (next.changes.length !== this.changes.length) return null;

    const byId = new Map(next.changes.map((c) => [c.id, c]));
    const merged: ReplacePointsCommand['changes'] = [];

    for (const c of this.changes) {
      const n = byId.get(c.id);
      if (!n) return null;
      if (JSON.stringify(n.from) !== JSON.stringify(c.to)) return null;
      merged.push({ id: c.id, from: c.from, to: n.to });
    }
    return new ReplacePointsCommand(merged);
  }
}

// ---------- Toggle occluded ----------

export class ToggleOccludedCommand implements Command {
  label = 'Toggle occluded';
  private readonly ids: string[];
  private readonly toValue: boolean;
  constructor(ids: string[], toValue: boolean) {
    this.ids = ids;
    this.toValue = toValue;
  }

  apply(ctx: CommandContext): void {
    ctx.replaceMany(this.ids, { occluded: this.toValue });
  }

  invert(): Command {
    return new ToggleOccludedCommand(this.ids, !this.toValue);
  }
}
