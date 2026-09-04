import { create } from 'zustand';
import { endpoints, TOKEN_KEY } from '@/lib/api';
import type { VerificationPending } from '@/lib/api';
import { deleteStoredValue, getStoredValue, setStoredValue } from '@/lib/token-storage';
import type { User } from '@/types';
type Credentials = { email: string; password: string }; type RegisterInput = Credentials & { name: string; studentId?: string };
type AuthState = { user: User | null; hydrated: boolean; bootstrap: () => Promise<void>; login: (input: Credentials) => Promise<void>; register: (input: RegisterInput) => Promise<VerificationPending>; verifyEmail: (input: { email: string; code: string }) => Promise<void>; refresh: () => Promise<void>; logout: () => Promise<void>; };
export const useAuth = create<AuthState>(set => ({
  user: null, hydrated: false,
  bootstrap: async () => { const token = await getStoredValue(TOKEN_KEY); if (!token) return set({ hydrated: true }); try { set({ user: await endpoints.me(), hydrated: true }); } catch { await deleteStoredValue(TOKEN_KEY); set({ user: null, hydrated: true }); } },
  login: async input => { const result = await endpoints.login({ ...input, email: input.email.trim().toLowerCase() }); await setStoredValue(TOKEN_KEY, result.token); set({ user: result.user }); },
  register: async input => endpoints.register({ ...input, email: input.email.trim().toLowerCase(), name: input.name.trim() }),
  verifyEmail: async input => { const result = await endpoints.verifyEmail({ ...input, email: input.email.trim().toLowerCase() }); await setStoredValue(TOKEN_KEY, result.token); set({ user: result.user }); },
  refresh: async () => set({ user: await endpoints.me() }),
  logout: async () => { await deleteStoredValue(TOKEN_KEY); set({ user: null }); },
}));
