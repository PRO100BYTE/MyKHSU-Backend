export const KRASNOYARSK_TIME_ZONE = 'Asia/Krasnoyarsk'

export function formatDateTimeKrasnoyarsk(value, fallback = '—') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ru-RU', { timeZone: KRASNOYARSK_TIME_ZONE })
}
