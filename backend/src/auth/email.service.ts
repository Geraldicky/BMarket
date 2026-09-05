import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

type CodeEmail = {
  email: string;
  code: string;
  name: string;
  subject: string;
  heading: string;
  description: string;
  devLabel: string;
};

type DeliverableEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly smtpFrom: string;
  private readonly brevoApiKey: string | null;
  private readonly brevoFromEmail: string | null;
  private readonly brevoFromName: string;

  constructor() {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    this.smtpFrom = process.env.SMTP_FROM?.trim() || `BMarket <${user || 'no-reply@localhost'}>`;
    this.transporter = user && pass
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT || 465),
          secure: (process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
          auth: { user, pass },
        })
      : null;

    this.brevoApiKey = process.env.BREVO_API_KEY?.trim() || null;
    this.brevoFromEmail = process.env.BREVO_FROM_EMAIL?.trim() || null;
    this.brevoFromName = process.env.BREVO_FROM_NAME?.trim() || 'BMarket';
  }

  async sendVerificationCode(email: string, code: string, name: string): Promise<void> {
    await this.sendCodeEmail({
      email,
      code,
      name,
      subject: `${code} adalah kode verifikasi BMarket kamu`,
      heading: 'Verifikasi email kampusmu',
      description: 'Masukkan kode berikut untuk menyelesaikan pendaftaran BMarket.',
      devLabel: 'verifikasi email',
    });
  }

  async sendPasswordResetCode(email: string, code: string, name: string): Promise<void> {
    await this.sendCodeEmail({
      email,
      code,
      name,
      subject: `${code} adalah kode reset password BMarket kamu`,
      heading: 'Atur ulang password BMarket',
      description: 'Masukkan kode berikut untuk melanjutkan penggantian password.',
      devLabel: 'reset password',
    });
  }

  async sendPasswordChangedNotice(email: string, name: string): Promise<void> {
    if (!this.hasEmailProvider()) {
      if (this.mayLogOtp()) {
        this.logger.log(`Notifikasi development: password ${email} berhasil diubah.`);
        return;
      }
      throw new ServiceUnavailableException('Layanan email belum dikonfigurasi.');
    }

    const safeName = this.escapeHtml(name);
    await this.deliver({
      to: email,
      subject: 'Password BMarket kamu telah diubah',
      text: [
        `Halo ${name},`,
        '',
        'Password akun BMarket kamu baru saja berhasil diubah.',
        'Jika bukan kamu yang melakukannya, segera hubungi administrator BMarket.',
      ].join('\n'),
      html: this.emailFrame(
        safeName,
        'Password berhasil diubah',
        'Password akun BMarket kamu baru saja diperbarui. Semua sesi lama telah dikeluarkan. Jika bukan kamu yang melakukannya, segera hubungi administrator BMarket.',
      ),
    });
  }

  private async sendCodeEmail(input: CodeEmail): Promise<void> {
    const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 10);
    if (!this.hasEmailProvider()) {
      if (this.mayLogOtp()) {
        this.logger.warn(`Email provider belum diatur. OTP development (${input.devLabel}) untuk ${input.email}: ${input.code}`);
        return;
      }
      throw new ServiceUnavailableException(
        'Layanan email belum dikonfigurasi. Hubungi administrator BMarket.',
      );
    }

    const safeName = this.escapeHtml(input.name);
    await this.deliver({
      to: input.email,
      subject: input.subject,
      text: [
        `Halo ${input.name},`,
        '',
        `${input.heading}.`,
        `Kode BMarket kamu adalah ${input.code}.`,
        `Kode ini berlaku selama ${ttlMinutes} menit dan hanya dapat digunakan satu kali.`,
        'Jika kamu tidak meminta kode ini, abaikan email ini.',
      ].join('\n'),
      html: this.emailFrame(
        safeName,
        input.heading,
        `${input.description}<div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;background:#eef6ff;border-radius:12px;padding:20px;color:#1167d8;margin:22px 0">${input.code}</div><span style="font-size:13px;color:#64748b">Kode berlaku selama ${ttlMinutes} menit dan hanya dapat digunakan satu kali. Jika kamu tidak meminta kode ini, abaikan email ini.</span>`,
      ),
    });
  }

  private emailFrame(safeName: string, heading: string, content: string): string {
    return `
      <div style="background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#14243b">
        <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #dce5ef;border-radius:16px;overflow:hidden">
          <div style="background:#0f2d4a;color:#fff;padding:24px 28px">
            <strong style="font-size:20px">BMarket</strong>
            <div style="font-size:12px;margin-top:4px;color:#b9cee0">Marketplace komunitas BINUS</div>
          </div>
          <div style="padding:28px">
            <p style="margin:0 0 12px">Halo ${safeName},</p>
            <h1 style="font-size:22px;margin:0 0 12px">${heading}</h1>
            <div style="line-height:1.6">${content}</div>
          </div>
        </div>
      </div>`;
  }

  private hasEmailProvider(): boolean {
    return Boolean((this.brevoApiKey && this.brevoFromEmail) || this.transporter);
  }

  private mayLogOtp(): boolean {
    return process.env.NODE_ENV !== 'production' &&
      (process.env.OTP_DEV_LOG ?? 'true').toLowerCase() === 'true';
  }

  private async deliver(message: DeliverableEmail): Promise<void> {
    try {
      // Render Free blocks outbound SMTP ports. Prefer Brevo's HTTPS API when configured.
      if (this.brevoApiKey && this.brevoFromEmail) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': this.brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              email: this.brevoFromEmail,
              name: this.brevoFromName,
            },
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
          }),
        });

        if (!response.ok) {
          const details = await response.text().catch(() => '');
          throw new Error(`Brevo API ${response.status}: ${details || response.statusText}`);
        }
        return;
      }

      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.smtpFrom,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        return;
      }

      throw new Error('Tidak ada email provider yang dikonfigurasi.');
    } catch (error) {
      this.logger.error(
        `Gagal mengirim email ke ${message.to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Email belum berhasil dikirim. Coba lagi beberapa saat.',
      );
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character] || character);
  }
}
