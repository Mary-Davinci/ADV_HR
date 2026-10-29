import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer, { type Transporter } from "nodemailer";

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

/** Invio email: SMTP in produzione, cartella "outbox" in sviluppo, memoria nei test. */
export interface Mailer {
  readonly mode: "smtp" | "outbox" | "memory";
  send(message: MailMessage): Promise<void>;
}

function toNodemailer(from: string, message: MailMessage) {
  return {
    from,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      contentType: attachment.contentType,
    })),
  };
}

export class SmtpMailer implements Mailer {
  readonly mode = "smtp" as const;
  private readonly transport: Transporter;

  constructor(
    options: { host: string; port: number; secure: boolean; user?: string; password?: string },
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password ?? "" } : undefined,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail(toNodemailer(this.from, message));
  }
}

/**
 * Nessun invio reale: ogni messaggio diventa un file .eml (apribile con
 * Outlook o Thunderbird) nella cartella indicata. Per sviluppo e collaudi.
 */
export class OutboxMailer implements Mailer {
  readonly mode = "outbox" as const;
  private readonly transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" });

  constructor(
    private readonly directory: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const info = await this.transport.sendMail(toNodemailer(this.from, message));
    await mkdir(this.directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const recipient = message.to.replace(/[^a-z0-9@._-]/gi, "_");
    await writeFile(path.join(this.directory, `${stamp}_${recipient}.eml`), info.message as Buffer);
  }
}

/** Per i test: conserva i messaggi in memoria. */
export class MemoryMailer implements Mailer {
  readonly mode = "memory" as const;
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}
