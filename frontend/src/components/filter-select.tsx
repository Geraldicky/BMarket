import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ComponentProps } from 'react';
import { Modal, Platform, Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { colors, makeStyles } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type FilterOption<T extends string> = { key: T; label: string; icon?: IconName };

// Non-clickable Pressable areas (backdrop) should not show the pointer cursor on web.
const defaultCursor = Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {};

/**
 * Compact dropdown for filters. The first option is treated as the "no filter" value;
 * any other selection highlights the trigger.
 */
export function FilterSelect<T extends string>({ label, icon, value, options, onChange, style }: {
  label: string;
  icon: IconName;
  value: T;
  options: FilterOption<T>[];
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
  const screenWidth = useWindowDimensions().width;
  const current = options.find(option => option.key === value);
  const filtered = value !== options[0]?.key;
  const open = () => triggerRef.current?.measureInWindow((x, y, width, height) => {
    const menuWidth = Math.max(width, 220);
    setAnchor({ x: Math.max(12, Math.min(x, screenWidth - menuWidth - 12)), y: y + height + 6, width });
  });

  return (
    <View style={[styles.select, style]}>
      <Pressable ref={triggerRef} onPress={open} style={({ pressed }) => [styles.trigger, filtered && styles.triggerActive, pressed && { opacity: .7 }]}>
        <Ionicons name={icon} size={17} color={filtered ? colors.primary : colors.muted} />
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.valueRow}>
            {current?.icon ? <Ionicons name={current.icon} size={13} color={filtered ? colors.primary : colors.text} /> : null}
            <Text numberOfLines={1} style={[styles.value, filtered && { color: colors.primary }]}>{current?.label || '-'}</Text>
          </View>
        </View>
        <Ionicons name={anchor ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </Pressable>
      <Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAnchor(null)}>
          {anchor ? <View style={[styles.menu, { left: anchor.x, top: anchor.y, width: Math.max(anchor.width, 220) }]}>
            {options.map(option => {
              const selected = option.key === value;
              return <Pressable key={option.key} onPress={() => { onChange(option.key); setAnchor(null); }} style={({ pressed }) => [styles.option, selected && styles.optionActive, pressed && { opacity: .7 }]}>
                <View style={styles.optionLabel}>
                  {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? colors.primary : colors.textSoft} /> : null}
                  <Text style={[styles.optionText, selected && styles.optionTextActive]}>{option.label}</Text>
                </View>
                {selected ? <Ionicons name="checkmark" size={17} color={colors.primary} /> : null}
              </Pressable>;
            })}
          </View> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  // No flex here: callers size the select (flex or width) via the `style` prop. Mixing a built-in
  // `flex: 1` with a caller's width can collapse the select to zero width on web.
  select: { minWidth: 0 },
  trigger: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  triggerActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  copy: { flex: 1, minWidth: 0 },
  label: { color: colors.muted, fontFamily: 'PoppinsMedium', fontSize: 10.5 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { flexShrink: 1, color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 13 },
  backdrop: { flex: 1, ...defaultCursor },
  menu: { position: 'absolute', padding: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, shadowColor: '#071727', shadowOpacity: .16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  option: { minHeight: 42, paddingHorizontal: 12, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionActive: { backgroundColor: colors.primarySoft },
  optionLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { color: colors.textSoft, fontFamily: 'PoppinsMedium', fontSize: 13.5 },
  optionTextActive: { color: colors.primary, fontFamily: 'PoppinsSemiBold' },
}));
