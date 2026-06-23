import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = parseInt((process.env.SMTP_PORT || "465").trim());
  const secure = port === 465;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : "";
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : "";

  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn("SMTP user or password not configured in .env. Skipping actual email sending.");
    console.log("=== DEV EMAIL LOG ===");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    if (options.text) console.log(`Text: ${options.text}`);
    if (options.html) console.log(`HTML: ${options.html}`);
    console.log("=====================");
    return;
  }

  const user = (process.env.SMTP_USER || "").trim();
  const mailOptions = {
    from: `"Coderoom" <${user}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await activeTransporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error(`Failed to send email to ${options.to}:`, error);
    console.log("=== DEV EMAIL LOG (FALLBACK) ===");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    if (options.text) console.log(`Text: ${options.text}`);
    if (options.html) console.log(`HTML: ${options.html}`);
    console.log("================================");
  }
};
