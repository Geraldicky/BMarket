export type Environment = Record<string, string | undefined>;

export function validateEnvironment(config: Environment) {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(
    key => !config[key]?.trim(),
  );

  if (missing.length) {
    throw new Error(
      `Environment variable wajib belum diisi: ${missing.join(', ')}`,
    );
  }

  if ((config.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET minimal 32 karakter.');
  }

  if (String(config.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() !== 'false') {
    throw new Error('Integrasi BMarket saat ini hanya mendukung MIDTRANS_IS_PRODUCTION=false (Sandbox).');
  }

  if (config.NODE_ENV === 'production') {
    const required = [
      'OTP_HASH_SECRET',
      'CORS_ORIGIN',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_STORAGE_BUCKET',
      'MIDTRANS_SERVER_KEY',
      'MIDTRANS_CLIENT_KEY',
    ];

    const missingProduction = required.filter(
      key => !config[key]?.trim(),
    );

    if (missingProduction.length) {
      throw new Error(
        `Konfigurasi production wajib belum diisi: ${missingProduction.join(', ')}`,
      );
    }

    const hasBrevo =
      Boolean(config.BREVO_API_KEY?.trim()) &&
      Boolean(config.BREVO_FROM_EMAIL?.trim());

    const hasSmtp =
      Boolean(config.SMTP_USER?.trim()) &&
      Boolean(config.SMTP_PASS?.trim());

    if (!hasBrevo && !hasSmtp) {
      throw new Error(
        'Provider email belum dikonfigurasi. Isi SMTP_USER dan SMTP_PASS.',
      );
    }

    if ((config.OTP_HASH_SECRET?.length ?? 0) < 32) {
      throw new Error(
        'OTP_HASH_SECRET minimal 32 karakter pada production.',
      );
    }

    if (config.CORS_ORIGIN?.includes('*')) {
      throw new Error(
        'CORS_ORIGIN production tidak boleh menggunakan wildcard.',
      );
    }
  }

  return config;
}

export function allowedOrigins(
  raw = process.env.CORS_ORIGIN ??
    'http://localhost:8081,http://localhost:19006',
) {
  return raw
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}
