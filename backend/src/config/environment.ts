export type Environment = Record<string, string | undefined>;

export function validateEnvironment(config: Environment) {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(key => !config[key]?.trim());
  if (missing.length) throw new Error(`Environment variable wajib belum diisi: ${missing.join(', ')}`);
  if ((config.JWT_SECRET?.length ?? 0) < 32) throw new Error('JWT_SECRET minimal 32 karakter.');

  if (config.NODE_ENV === 'production') {
    const required = [
      'OTP_HASH_SECRET',
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASS',
      'CORS_ORIGIN',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_STORAGE_BUCKET',
    ];
    const missingProduction = required.filter(key => !config[key]?.trim());
    if (missingProduction.length) {
      throw new Error(`Konfigurasi production wajib belum diisi: ${missingProduction.join(', ')}`);
    }
    if ((config.OTP_HASH_SECRET?.length ?? 0) < 32) {
      throw new Error('OTP_HASH_SECRET minimal 32 karakter pada production.');
    }
    if (config.CORS_ORIGIN?.includes('*')) {
      throw new Error('CORS_ORIGIN production tidak boleh menggunakan wildcard.');
    }
  }

  return config;
}

export function allowedOrigins(raw = process.env.CORS_ORIGIN ?? 'http://localhost:8081,http://localhost:19006') {
  return raw.split(',').map(value => value.trim()).filter(Boolean);
}
