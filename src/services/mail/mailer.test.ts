import { mkdtemp, readdir, readFile, rmdir, unlink } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { OutboxMailer, SmtpMailer } from "./mailer";

const message = {
  to: "recipient@example.invalid",
  subject: "Test delivery",
  text: "A local delivery test.",
  html: "<p>A local delivery test.</p>",
  attachments: [
    { filename: "document.pdf", content: new Uint8Array([37, 80, 68, 70]), contentType: "application/pdf" },
  ],
};

describe("mail security and compatibility", () => {
  it("generates a real multipart message with an attachment without sending email", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "adv-hr-mail-"));
    try {
      await new OutboxMailer(directory, "sender@example.invalid").send(message);
      const files = await readdir(directory);
      expect(files).toHaveLength(1);
      const eml = await readFile(path.join(directory, files[0]!), "utf8");
      expect(eml).toContain("Subject: Test delivery");
      expect(eml).toContain("multipart/mixed");
      expect(eml).toContain("application/pdf");
      expect(eml).toContain("document.pdf");
    } finally {
      for (const file of await readdir(directory)) await unlink(path.join(directory, file));
      await rmdir(directory);
    }
  });

  it("refuses SMTP authentication when a server cannot establish STARTTLS", async () => {
    const commands: string[] = [];
    const connections = new Set<Socket>();
    const server = createServer((socket) => {
      connections.add(socket);
      socket.on("close", () => connections.delete(socket));
      socket.write("220 localhost SMTP test\r\n");
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        let end: number;
        while ((end = buffer.indexOf("\r\n")) !== -1) {
          const command = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          commands.push(command.split(" ")[0]!);
          if (command.startsWith("EHLO")) socket.write("250-localhost\r\n250 AUTH LOGIN PLAIN\r\n");
          else if (command === "STARTTLS") socket.write("454 TLS unavailable\r\n");
          else socket.write("500 Unsupported\r\n");
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing local SMTP port");
      const mailer = new SmtpMailer(
        { host: "127.0.0.1", port: address.port, secure: false, user: "test", password: "test" },
        "sender@example.invalid",
      );
      await expect(mailer.send(message)).rejects.toMatchObject({ code: "ETLS" });
      expect(commands).toContain("STARTTLS");
      expect(commands).not.toContain("AUTH");
      expect(commands).not.toContain("DATA");
    } finally {
      for (const connection of connections) connection.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
