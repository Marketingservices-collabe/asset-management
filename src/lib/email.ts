/**
 * Email sender stub. No SMTP is configured for the internal deployment yet;
 * this logs what would be sent and records nothing external. Swap the body for
 * nodemailer / Resend / SES when a transport is chosen.
 */
export async function sendMail(opts: { to: string[]; subject: string; text: string }) {
  if (opts.to.length === 0) return;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] → ${opts.to.join(", ")}: ${opts.subject}\n${opts.text}\n`);
  }
  // TODO: real transport
}
