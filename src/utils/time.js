/**
 * Time utility functions for Exam System with full Solar Hijri (Jalali) & Tehran Timezone support.
 */
import { toGregorian } from 'jalaali-js';

const PERSIAN_MONTHS = {
  'فروردین': 1, 'farvardin': 1,
  'اردیبهشت': 2, 'ordibehesht': 2,
  'خرداد': 3, 'khordad': 3,
  'تیر': 4, 'tir': 4,
  'مرداد': 5, 'mordad': 5,
  'شهریور': 6, 'shahrivar': 6,
  'مهر': 7, 'mehr': 7,
  'آبان': 8, 'aban': 8,
  'آذر': 9, 'azar': 9,
  'دی': 10, 'dey': 10,
  'بهمن': 11, 'bahman': 11,
  'اسفند': 12, 'esfand': 12
};

/**
 * Converts Persian/Arabic digits (۰-۹) to standard ASCII digits (0-9).
 * @param {string} str 
 * @returns {string}
 */
export function toEnglishDigits(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

/**
 * Formats a Date object into a Solar Hijri (Jalali) date string in Asia/Tehran timezone.
 * @param {Date|string|number} date 
 * @param {boolean} includeTime 
 * @returns {string}
 */
export function formatJalaliDate(date, includeTime = true) {
  if (!date) return 'نامشخص';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'نامشخص';

  const options = {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian'
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(d);
}

/**
 * Formats a Date into a clean readable Persian Jalali date string in Tehran time
 * @param {Date|string} date 
 * @returns {string}
 */
export function formatDateReadable(date) {
  return formatJalaliDate(date, true);
}

/**
 * Parses a flexible date string (Jalali or ISO/standard) into a JS Date in Tehran time (+03:30 offset).
 * Examples supported:
 * - "1404/05/15 08:00", "1404-05-15 08:00", "۱۴۰۴/۰۵/۱۵ ۰۸:۰۰"
 * - "15 مرداد 1404 08:00", "15 Mordad 1404 08:00"
 * - ISO string: "2026-08-01T08:00" or standard Date
 * 
 * @param {string|Date} dateStr 
 * @returns {Date}
 */
export function parseFlexibleDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  const raw = String(dateStr).trim();
  const normalized = toEnglishDigits(raw);

  // 1. Match numeric YYYY/MM/DD HH:mm or YYYY-MM-DD HH:mm
  const ymdMatch = normalized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ymdMatch) {
    const [, yStr, mStr, dStr, hhStr = '0', mmStr = '0', ssStr = '0'] = ymdMatch;
    const y = Number(yStr), m = Number(mStr), d = Number(dStr);
    const hh = String(Number(hhStr)).padStart(2, '0');
    const mm = String(Number(mmStr)).padStart(2, '0');
    const ss = String(Number(ssStr)).padStart(2, '0');

    // If Jalali year (1300 to 1500)
    if (y >= 1300 && y <= 1500) {
      const g = toGregorian(y, m, d);
      const iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}T${hh}:${mm}:${ss}+03:30`;
      return new Date(iso);
    } else if (y > 1900) {
      // Gregorian input without timezone offset, treat as Tehran time
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hh}:${mm}:${ss}+03:30`;
      return new Date(iso);
    }
  }

  // 2. Match text Jalali format: e.g. "15 مرداد 1404 08:00" or "15 Mordad 1404 08:00"
  const textMatch = normalized.match(/^(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/i);
  if (textMatch) {
    const [, dStr, mName, yStr, hhStr = '0', mmStr = '0'] = textMatch;
    const mNum = PERSIAN_MONTHS[mName.toLowerCase()];
    const y = Number(yStr), d = Number(dStr);
    const hh = String(Number(hhStr)).padStart(2, '0');
    const mm = String(Number(mmStr)).padStart(2, '0');

    if (mNum && y >= 1300 && y <= 1500) {
      const g = toGregorian(y, mNum, d);
      const iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}T${hh}:${mm}:00+03:30`;
      return new Date(iso);
    }
  }

  // 3. Fallback standard Date parsing
  const std = new Date(normalized);
  if (!isNaN(std.getTime())) return std;

  return new Date();
}

/**
 * Calculates remaining seconds for an attempt considering BOTH duration and allowed window end date.
 * @param {Date} startTime 
 * @param {number} durationMinutes 
 * @param {Date} allowedEndDate 
 * @returns {{ remainingSeconds: number, actualEndTime: Date, isExpired: boolean }}
 */
export function calculateRemainingSeconds(startTime, durationMinutes, allowedEndDate) {
  const startMs = new Date(startTime).getTime();
  const durationMs = durationMinutes * 60 * 1000;
  const durationEndTime = new Date(startMs + durationMs);
  
  const windowEndTime = new Date(allowedEndDate);

  // Take the EARLIER of duration end time or allowed window end time
  const actualEndTime = durationEndTime.getTime() < windowEndTime.getTime() 
    ? durationEndTime 
    : windowEndTime;

  const nowMs = Date.now();
  const diffMs = actualEndTime.getTime() - nowMs;
  const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));

  return {
    remainingSeconds,
    actualEndTime,
    isExpired: remainingSeconds <= 0
  };
}

/**
 * Formats seconds into HH:MM:SS or MM:SS string
 * @param {number} totalSeconds 
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  if (totalSeconds <= 0) return "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num) => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

