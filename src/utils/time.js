const KRASNOYARSK_TIME_ZONE = 'Asia/Krasnoyarsk'

const formatterDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: KRASNOYARSK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const formatterDateOnly = new Intl.DateTimeFormat('sv-SE', {
  timeZone: KRASNOYARSK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const formatterHumanRu = new Intl.DateTimeFormat('ru-RU', {
  timeZone: KRASNOYARSK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function getParts(value = new Date()) {
  const normalized = value instanceof Date ? value : new Date(value)
  const source = Number.isNaN(normalized.getTime()) ? new Date() : normalized
  const parts = formatterDateTime.formatToParts(source)
  const map = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return map
}

export function formatKrasnoyarskSql(value = new Date()) {
  const parts = getParts(value)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function formatKrasnoyarskIso(value = new Date()) {
  const parts = getParts(value)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`
}

export function formatKrasnoyarskDate(value = new Date()) {
  const normalized = value instanceof Date ? value : new Date(value)
  const source = Number.isNaN(normalized.getTime()) ? new Date() : normalized
  return formatterDateOnly.format(source)
}

export function formatKrasnoyarskHuman(value = new Date()) {
  const normalized = value instanceof Date ? value : new Date(value)
  const source = Number.isNaN(normalized.getTime()) ? new Date() : normalized
  return formatterHumanRu.format(source)
}

export function nowKrasnoyarskSql() {
  return formatKrasnoyarskSql(new Date())
}

export function nowKrasnoyarskIso() {
  return formatKrasnoyarskIso(new Date())
}

export function plusHoursKrasnoyarskSql(hours = 0) {
  const safeHours = Number.isFinite(Number(hours)) ? Number(hours) : 0
  return formatKrasnoyarskSql(new Date(Date.now() + safeHours * 60 * 60 * 1000))
}

export const KRASNOYARSK_TIME_ZONE_NAME = KRASNOYARSK_TIME_ZONE
export const KRASNOYARSK_TIME_ZONE_LABEL = 'Asia/Krasnoyarsk (GMT+7)'
