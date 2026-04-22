/**
 * Утилиты для работы с датами и неделями.
 * Логика соответствует оригинальному Go-коду (internal/user/utils.go).
 */

/**
 * Возвращает дату начала ISO-недели (понедельник) по её номеру.
 * Использует подход: отсчёт от 1 января текущего года.
 * @param {number} weekNumber
 * @returns {{ dateStart: string, dateEnd: string }} формат 'YYYY-MM-DD'
 */
export function getWeekDates(weekNumber) {
  const now = new Date();
  const year = now.getFullYear();

  // Найти первый понедельник года
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0=Вс, 1=Пн ...
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
  // Если jan1 сам понедельник — 0 дней, иначе сдвиг
  const firstMonday = new Date(year, 0, 1 + (dayOfWeek === 1 ? 0 : daysToFirstMonday));

  const monday = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400_000);
  const sunday = new Date(monday.getTime() + 6 * 86400_000);

  return {
    dateStart: formatDate(monday),
    dateEnd:   formatDate(sunday),
  };
}

/**
 * Форматирует дату в 'YYYY-MM-DD'.
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Парсит дату из формата 'dd.MM.yyyy' или 'yyyy-MM-dd' в строку 'yyyy-MM-dd'.
 * @param {string} dateStr
 * @returns {string}
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  // dd.MM.yyyy → yyyy-MM-dd
  const dmyMatch = dateStr.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
  }
  return dateStr;
}

/**
 * Возвращает текущий номер учебной недели (относительно начала года).
 */
export function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diffMs = now - startOfYear;
  const diffDays = Math.floor(diffMs / 86400_000);
  return Math.ceil((diffDays + startOfYear.getDay() + 1) / 7);
}

/**
 * Возвращает номер дня недели (1=Пн … 7=Вс) по дате.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {number}
 */
export function weekdayFromDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Вс
  return day === 0 ? 7 : day;
}
