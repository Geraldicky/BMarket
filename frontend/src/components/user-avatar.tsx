import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export function userInitials(name?: string | null) {
  const words = name?.trim().split(/\s+/).filter(Boolean) || [];
  if (!words.length) return '?';
  const initials = words.length === 1 ? words[0][0] : `${words[0][0]}${words.at(-1)![0]}`;
  return initials.toUpperCase();
}

export function UserAvatar({ name, avatarUrl, style, imageStyle, textStyle }: {
  name?: string | null;
  avatarUrl?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(avatarUrl && avatarUrl !== failedUrl);

  return (
    <View accessibilityLabel={name ? `Avatar ${name}` : 'Avatar pengguna'} style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {showImage
        ? <Image source={avatarUrl!} contentFit="cover" style={[{ width: '100%', height: '100%' }, imageStyle]} onError={() => setFailedUrl(avatarUrl!)} />
        : <Text style={textStyle}>{userInitials(name)}</Text>}
    </View>
  );
}
