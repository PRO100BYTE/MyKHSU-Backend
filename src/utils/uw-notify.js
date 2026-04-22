/**
 * Email-уведомления для Единого окна.
 * Использует nodemailer (опционально). Если SMTP не настроен — молча пропускает.
 */

let transporter = null
let transporterReady = false

async function getTransporter() {
  if (transporterReady) return transporter

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    transporterReady = true
    return null
  }

  try {
    const nodemailer = await import('nodemailer')
    transporter = nodemailer.default.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    })
    transporterReady = true
  } catch {
    transporterReady = true
    transporter = null
  }

  return transporter
}

/**
 * Отправляет email-уведомление по тикету ЕО.
 * @param {{ to: string, subject: string, text: string, html?: string }} opts
 */
export async function sendUnifiedWindowEmail({ to, subject, text, html }) {
  if (!to) return

  const t = await getTransporter()
  if (!t) return

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER

  try {
    await t.sendMail({ from, to, subject, text, html: html ?? text })
  } catch (err) {
    // Не прерываем основной поток из-за ошибки почты
    console.error('[uw-notify] Failed to send email:', err.message)
  }
}
