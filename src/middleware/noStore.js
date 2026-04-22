/**
 * Устанавливает заголовки, запрещающие кэширование.
 * Аналог Go-пакета utils/middleware/no_store.go
 */
export function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
