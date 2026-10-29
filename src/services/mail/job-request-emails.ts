import type { MailAttachment, MailMessage } from "./mailer";

/**
 * Testi delle email del modulo Job Description. Ogni valore inserito da
 * utenti o aziende passa da `escape` prima di finire nell'HTML.
 */

const BRAND = "Accademia Da Vinci";

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e7e2d6">
<tr><td style="padding:24px 28px 8px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#7a5a12;font-weight:bold">${BRAND}</td></tr>
<tr><td style="padding:0 28px 8px"><h1 style="font-size:20px;line-height:1.3;margin:8px 0 12px">${escape(title)}</h1></td></tr>
<tr><td style="padding:0 28px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
</table>
<p style="font-size:12px;color:#7d7a72;max-width:600px;margin:16px auto 0;line-height:1.5">${BRAND} · Ente di Formazione Nazionale · Via A. Cechov, 50 – 20151 Milano · www.davinciformazione.com</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escape(href)}" style="display:inline-block;background:#7a5a12;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${escape(label)}</a></p>
<p style="font-size:13px;color:#5f5c55">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><span style="word-break:break-all">${escape(href)}</span></p>`;
}

/** Invito all'azienda: cosa fare, link personale, modulo vuoto in allegato come riferimento. */
export function invitationEmail(input: {
  to: string;
  companyName: string;
  code: string;
  link: string;
  expiresAt: Date;
  senderName: string;
  replyTo: string | null;
  blankForm: MailAttachment;
}): MailMessage {
  const expires = formatDate(input.expiresAt);
  const steps = [
    "Apri il link personale qui sotto e compila il modulo online (puoi salvare e riprendere in qualsiasi momento).",
    "Al termine premi «Invia il modulo»: il sistema controlla che tutti i dati siano completi e corretti.",
    "Scarica il PDF compilato, fallo firmare e timbrare dal legale rappresentante.",
    "Carica la scansione del modulo firmato dalla stessa pagina.",
  ];
  const subject = `${BRAND} – modulo Job Description da compilare (${input.code})`;
  const text = [
    `Gentile ${input.companyName},`,
    "",
    "per avviare la selezione del personale vi chiediamo di compilare il modulo Job Description (Allegato 1).",
    "",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `Link personale (valido fino al ${expires}):`,
    input.link,
    "",
    "In allegato trovate il modulo vuoto, solo come riferimento: la compilazione avviene online.",
    "Il link è personale: non inoltratelo a persone esterne alla vostra azienda.",
    "",
    "Cordiali saluti,",
    `${input.senderName} – ${BRAND}`,
  ].join("\n");
  const html = layout(
    "Modulo Job Description da compilare",
    `<p>Gentile <strong>${escape(input.companyName)}</strong>,</p>
<p>per avviare la selezione del personale vi chiediamo di compilare il modulo <strong>Job Description</strong> (Allegato 1).</p>
<ol style="padding-left:20px;margin:16px 0">${steps.map((step) => `<li style="margin-bottom:6px">${escape(step)}</li>`).join("")}</ol>
${button(input.link, "Compila il modulo online")}
<p style="font-size:14px">Il link è valido fino al <strong>${escape(expires)}</strong> ed è personale: non inoltratelo a persone esterne alla vostra azienda.
In allegato trovate il modulo vuoto, solo come riferimento.</p>
<p>Cordiali saluti,<br>${escape(input.senderName)} – ${BRAND}</p>
<p style="font-size:12px;color:#7d7a72">Riferimento richiesta: ${escape(input.code)}</p>`,
  );
  return {
    to: input.to,
    subject,
    text,
    html,
    replyTo: input.replyTo ?? undefined,
    attachments: [input.blankForm],
  };
}

/** Conferma all'azienda dopo l'invio del modulo: PDF compilato in allegato, da firmare e ricaricare. */
export function companySubmittedEmail(input: {
  to: string;
  companyName: string;
  code: string;
  revision: number;
  link: string;
  pdf: MailAttachment;
  replyTo: string | null;
}): MailMessage {
  const subject = `${BRAND} – modulo ${input.code} ricevuto: manca la firma`;
  const text = [
    `Gentile ${input.companyName},`,
    "",
    `abbiamo ricevuto il modulo Job Description ${input.code} (revisione ${input.revision}). Grazie!`,
    "",
    "Ultimo passaggio: stampate il PDF allegato, fatelo firmare e timbrare dal legale rappresentante",
    "e caricate la scansione dalla stessa pagina:",
    input.link,
    "",
    `Cordiali saluti,\n${BRAND}`,
  ].join("\n");
  const html = layout(
    "Modulo ricevuto: manca solo la firma",
    `<p>Gentile <strong>${escape(input.companyName)}</strong>,</p>
<p>abbiamo ricevuto il modulo Job Description <strong>${escape(input.code)}</strong> (revisione ${input.revision}). Grazie!</p>
<p><strong>Ultimo passaggio:</strong> stampate il PDF allegato, fatelo firmare e timbrare dal legale rappresentante e caricate la scansione dalla stessa pagina.</p>
${button(input.link, "Carica il modulo firmato")}
<p>Cordiali saluti,<br>${BRAND}</p>`,
  );
  return { to: input.to, subject, text, html, replyTo: input.replyTo ?? undefined, attachments: [input.pdf] };
}

/** Notifica interna a HR (nessun dato personale dei candidati). */
export function hrNotificationEmail(input: {
  to: string;
  event: "submitted" | "signed";
  companyName: string;
  code: string;
  role: string;
  requestUrl: string;
}): MailMessage {
  const submitted = input.event === "submitted";
  const subject = submitted
    ? `[ADV_HR] ${input.companyName} ha compilato la Job Description ${input.code}`
    : `[ADV_HR] ${input.companyName} ha caricato il modulo firmato ${input.code}`;
  const lines = submitted
    ? [
        `L'azienda ${input.companyName} ha compilato e inviato il modulo ${input.code} (${input.role}).`,
        "La job description è pronta in ADV_HR, con la lista dei candidati suggeriti.",
        "In attesa del modulo firmato.",
      ]
    : [
        `L'azienda ${input.companyName} ha caricato il modulo firmato ${input.code} (${input.role}).`,
        "Verifica firma, timbro e codice, poi apri la selezione.",
      ];
  return {
    to: input.to,
    subject,
    text: [...lines, "", input.requestUrl].join("\n"),
    html: layout(
      submitted ? "Job Description compilata dall'azienda" : "Modulo firmato da verificare",
      `${lines.map((line) => `<p>${escape(line)}</p>`).join("")}${button(input.requestUrl, "Apri la richiesta in ADV_HR")}`,
    ),
  };
}
