import { pairsDb } from '../db/database.js';
import { normalizeDate, weekdayFromDate } from '../utils/dates.js';

/**
 * Импортирует расписание из JSON-структуры оригинального формата (KHSU API).
 *
 * Ожидаемая структура:
 * {
 *   Timetable: [
 *     {
 *       WeekNumber: number,
 *       DateStart: string,
 *       DateEnd: string,
 *       Groups: [
 *         {
 *           Course: number,
 *           GroupName: string,
 *           Faculty: string,
 *           Days: [
 *             {
 *               Weekday: number,          // 1=Пн … 7=Вс
 *               WeekNumber: number,
 *               Lessons: [
 *                 {
 *                   Time: number,
 *                   Type: string,
 *                   Subject: string,
 *                   Teachers:   [{ TeacherName: string }],
 *                   Auditories: [{ AuditoryName: string }],
 *                   Date: string,         // "2.01.2006" или "2006-01-02"
 *                   Subgroup: number,
 *                   Week: number,
 *                 }
 *               ]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * @param {object} data   Распарсенный JSON
 * @returns {number}      Количество вставленных строк
 */
export function importTimetable(data) {
  const timetable = data?.Timetable ?? data?.timetable ?? [];

  if (!Array.isArray(timetable) || timetable.length === 0) {
    throw new Error('No timetable data found in JSON (expected Timetable array)');
  }

  const stmt = pairsDb.prepare(
    `INSERT INTO pairs
       (week_number, weekday, course, group_name, date, time,
        type, subject, teacher, auditory, date_start, date_end)
     VALUES
       (@week_number, @weekday, @course, @group_name, @date, @time,
        @type, @subject, @teacher, @auditory, @date_start, @date_end)`
  );

  let count = 0;

  const insertAll = pairsDb.transaction(() => {
    for (const weekBlock of timetable) {
      const weekNumber = weekBlock.WeekNumber ?? weekBlock.week_number ?? 0;
      const dateStart  = normalizeDate(weekBlock.DateStart ?? weekBlock.date_start ?? '');
      const dateEnd    = normalizeDate(weekBlock.DateEnd   ?? weekBlock.date_end   ?? '');
      const groups     = weekBlock.Groups ?? weekBlock.groups ?? [];

      for (const group of groups) {
        const course    = group.Course    ?? group.course    ?? 0;
        const groupName = group.GroupName ?? group.group_name ?? '';
        const days      = group.Days      ?? group.days      ?? [];

        for (const day of days) {
          const weekday = day.Weekday ?? day.weekday ?? 0;
          const lessons = day.Lessons ?? day.lessons ?? [];

          for (const lesson of lessons) {
            const date = normalizeDate(lesson.Date ?? lesson.date ?? '');
            const effectiveWeekday = weekday || (date ? weekdayFromDate(date) : 0);

            const teacher   = (lesson.Teachers   ?? lesson.teachers   ?? []).map(t => t.TeacherName   ?? t.teacher_name   ?? '').filter(Boolean).join(', ');
            const auditory  = (lesson.Auditories ?? lesson.auditories ?? []).map(a => a.AuditoryName  ?? a.auditory_name  ?? '').filter(Boolean).join(', ');

            stmt.run({
              week_number: weekNumber,
              weekday:     effectiveWeekday,
              course,
              group_name:  groupName,
              date,
              time:        lesson.Time      ?? lesson.time      ?? null,
              type:        lesson.Type      ?? lesson.type      ?? null,
              subject:     lesson.Subject   ?? lesson.subject   ?? null,
              teacher:     teacher   || null,
              auditory:    auditory  || null,
              date_start:  dateStart || null,
              date_end:    dateEnd   || null,
            });
            count++;
          }
        }
      }
    }
  });

  insertAll();
  return count;
}
