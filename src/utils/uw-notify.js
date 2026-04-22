import { config } from '../config.js'

let transporterPromise = null

async function getTransporter() {
  if (transporterPromise) return transporterPromise

  transporterPromise = (async () => {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.smtpFrom) {
      return null
    }

    try {
      const nodemailer = await import('nodemailer')
      return nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      })
    } catch {
      return null
    }
  })()

  return transporterPromise
}

export async function sendUnifiedWindowEmail({ to, subject, text }) {
  if (!to) return { sent: false, reason: 'no-recipient' }

  const transporter = await getTransporter()
  if (!transporter) {
    return { sent: false, reason: 'smtp-not-configured' }
  }

  try {
    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text,
    })
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error?.message || 'send-failed' }
  }
}
