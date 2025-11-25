// middleware/trackUserActivity.ts
import type { Request, Response, NextFunction } from 'express';
import { UAParser } from 'ua-parser-js';
import User from '../models/User';

export async function trackUserActivity(req: any, _res: Response, next: NextFunction) {
  try {
    const authUser = req.user; // tumhare authenticate middleware se set hota hai
    if (!authUser?.id) return next();

    const uaString = String(req.headers['user-agent'] || '');
    const parser = new UAParser(uaString);
    const ua = parser.getResult();

    const update: any = {
      lastLogin: new Date(),
      lastBrowser: ua.browser.name || 'Unknown',
      lastOS: ua.os.name || 'Unknown',
      lastDeviceType: ua.device.type || 'desktop',
    };

    // Agar tum GeoIP / city use karte ho to yahan add kar sakte ho
    // update.lastCity = req.geo?.city;
    // update.lastCountry = req.geo?.country;

    User.findByIdAndUpdate(authUser.id, update).catch((e) =>
      console.error('trackUserActivity update error', e.message)
    );
  } catch (e) {
    console.error('trackUserActivity error', (e as any).message);
  }

  next();
}
