export const toIST = (d: Date | string) =>
  new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
