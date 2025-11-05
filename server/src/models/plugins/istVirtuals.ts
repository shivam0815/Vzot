import { Schema } from 'mongoose';

type Opts = {
  extraDateFields?: string[];
  timeZone?: string;
  format?: Intl.DateTimeFormatOptions;
};

export default function istVirtualsPlugin(schema: Schema, opts: Opts = {}) {
  const timeZone = opts.timeZone || 'Asia/Kolkata';
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...opts.format,
  };

  const attachIST = (field: string) => {
    if (!schema.path(field)) return;
    const virt = field + 'IST';
    if ((schema as any).virtuals?.[virt]) return;
    schema.virtual(virt).get(function () {
      const d = this.get(field);
      if (!d) return null;
      if (d instanceof Date || typeof d === 'string' || typeof d === 'number') {
        return new Date(d).toLocaleString('en-IN', fmt);
      }
      return null;
    });
  };

  ['createdAt', 'updatedAt'].forEach(attachIST);
  (opts.extraDateFields || []).forEach(attachIST);

  if (!schema.get('toJSON')?.virtuals) schema.set('toJSON', { virtuals: true });
  if (!schema.get('toObject')?.virtuals) schema.set('toObject', { virtuals: true });
}
