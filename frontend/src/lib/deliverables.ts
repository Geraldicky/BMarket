import type Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import { deliverableDownloadUrl } from '@/lib/api';
import type { TransactionDeliverable } from '@/types';

type SignedLink = { token: string; mode: 'preview' | 'download' };

export function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function deliverableIcon(file: Pick<TransactionDeliverable, 'fileName' | 'mimeType'>): ComponentProps<typeof Ionicons>['name'] {
  const name = file.fileName.toLowerCase();
  if (file.mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/.test(name)) return 'image-outline';
  if (/\.pdf$/.test(name)) return 'document-text-outline';
  if (/\.(zip|rar|7z)$/.test(name)) return 'archive-outline';
  if (/\.(js|jsx|ts|tsx|py|ipynb|java|kt|swift|c|cpp|h|cs|go|rb|php|html|css|json|sql|xml|ya?ml)$/.test(name)) return 'code-slash-outline';
  return 'document-outline';
}

// Mirrors the backend: files the browser can show inline (PDF, images, text/code).
export function canPreviewDeliverable(fileName: string) {
  return /\.(pdf|jpe?g|png|webp|gif|txt|md|csv|js|jsx|ts|tsx|py|ipynb|java|kt|swift|c|cpp|h|cs|go|rb|php|html|css|json|sql|xml|ya?ml)$/.test(fileName.toLowerCase());
}

export const isZipDeliverable = (fileName: string) => /\.zip$/i.test(fileName);

// On web a preview tab must be opened synchronously inside the press handler, or popup blockers stop it.
export function reservePreviewTab(): Window | null {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank') : null;
}

// Fetches a short-lived signed link, then shows it inline (preview) or hands it to the browser (download).
export async function openSignedFile(getLink: () => Promise<SignedLink>, popup: Window | null) {
  try {
    const link = await getLink();
    const url = deliverableDownloadUrl(link.token);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (link.mode === 'preview' && popup) { popup.opener = null; popup.location.href = url; }
      else { popup?.close(); window.location.assign(url); }
    } else if (link.mode === 'preview') await WebBrowser.openBrowserAsync(url);
    else await Linking.openURL(url);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export async function openPreviewUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  else await WebBrowser.openBrowserAsync(url);
}
