import { BadRequestException } from '@nestjs/common';

export type Environment = Record<string, string | undefined>;
export function validateEnvironment(config: Environment) {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(key => !config[key]?.trim());
  if (missing.length) throw new Error(`Environment variable wajib belum diisi: ${missing.join(', ')}`);
  if ((config.JWT_SECRET?.length ?? 0) < 32) throw new Error('JWT_SECRET minimal 32 karakter.');
  if (config.NODE_ENV === 'production') {
    const missingMail = ['SMTP_USER', 'SMTP_PASS'].filter(key => !config[key]?.trim());
    if (missingMail.length) {
      throw new Error(`SMTP wajib dikonfigurasi pada production: ${missingMail.join(', ')}`);
    }
  }
  return config;
}
export function allowedOrigins(raw = process.env.CORS_ORIGIN ?? 'http://localhost:8081,http://localhost:19006') {
  return raw.split(',').map(value => value.trim()).filter(Boolean);
}
