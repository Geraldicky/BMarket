import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow } from '@/constants/theme';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const pad = (value: number) => String(value).padStart(2, '0');

export function formatLocalDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDateTimeValue(value?: string | null) {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDisplay(value: string) {
  const parsed = parseLocalDateTimeValue(value);
  if (!parsed) return '';
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()].slice(0, 3)} ${parsed.getFullYear()} · ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  defaultTime?: string;
  minDate?: Date | null;
  optional?: boolean;
};

export function DateTimePickerField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = 'Pilih tanggal dan waktu',
  defaultTime = '12:00',
  minDate,
  optional,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDateTimeValue(value);
  const initial = selected || minDate || new Date();
  const [draftDate, setDraftDate] = useState(initial);
  const [monthCursor, setMonthCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [time, setTime] = useState(selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : defaultTime);
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (!open) return;
    const nextSelected = parseLocalDateTimeValue(value);
    const base = nextSelected || minDate || new Date();
    setDraftDate(base);
    setMonthCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setTime(nextSelected ? `${pad(nextSelected.getHours())}:${pad(nextSelected.getMinutes())}` : defaultTime);
    setTimeError('');
  }, [open, value, defaultTime, minDate]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: mondayIndex }, () => null),
      ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [monthCursor]);

  const apply = () => {
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      setTimeError('Gunakan format waktu HH:mm, misalnya 20:00.');
      return;
    }
    const result = new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate(), Number(match[1]), Number(match[2]), 0, 0);
    onChange(formatLocalDateTimeValue(result));
    setOpen(false);
  };

  const previousDisabled = Boolean(minDate && new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 0) < dateOnly(minDate));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, error && styles.fieldError]}>
        <View style={styles.leadingIcon}><Ionicons name="calendar-outline" size={18} color={colors.primary} /></View>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>{value ? formatDisplay(value) : placeholder}</Text>
        <Ionicons name="chevron-down" size={17} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modal, shadow]} onPress={event => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{label}</Text>
                <Text style={styles.modalCopy}>Pilih tanggal dari kalender, lalu tentukan waktunya.</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.textSoft} /></Pressable>
            </View>

            <View style={styles.monthHeader}>
              <Pressable disabled={previousDisabled} onPress={() => setMonthCursor(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={[styles.navButton, previousDisabled && styles.disabled]}>
                <Ionicons name="chevron-back" size={18} color={colors.textSoft} />
              </Pressable>
              <Text style={styles.monthTitle}>{MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}</Text>
              <Pressable onPress={() => setMonthCursor(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.navButton}>
                <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>{DAYS.map(day => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
            <View style={styles.calendarGrid}>
              {cells.map((day, index) => {
                if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
                const disabled = Boolean(minDate && dateOnly(day) < dateOnly(minDate));
                const active = dateOnly(day).getTime() === dateOnly(draftDate).getTime();
                const today = dateOnly(day).getTime() === dateOnly(new Date()).getTime();
                return (
                  <Pressable key={day.toISOString()} disabled={disabled} onPress={() => setDraftDate(day)} style={[styles.dayCell, active && styles.dayCellActive, disabled && styles.disabled]}>
                    <Text style={[styles.dayText, active && styles.dayTextActive, today && !active && styles.dayTextToday]}>{day.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.timeSection}>
              <View style={styles.timeLabelRow}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.timeLabel}>Waktu</Text>
              </View>
              <TextInput
                value={time}
                onChangeText={text => { setTime(text.replace(/[^0-9:]/g, '').slice(0, 5)); setTimeError(''); }}
                placeholder="20:00"
                placeholderTextColor={colors.muted}
                keyboardType="default"
                style={[styles.timeInput, timeError && styles.fieldError]}
              />
              {timeError ? <Text style={styles.error}>{timeError}</Text> : <Text style={styles.hint}>Format 24 jam · contoh 09:30 atau 20:00</Text>}
            </View>

            <View style={styles.actions}>
              {optional && value ? <Pressable onPress={() => { onChange(''); setOpen(false); }} style={styles.clearButton}><Text style={styles.clearText}>Kosongkan</Text></Pressable> : <View />}
              <View style={styles.actionsRight}>
                <Pressable onPress={() => setOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Batal</Text></Pressable>
                <Pressable onPress={apply} style={styles.primaryButton}><Ionicons name="checkmark" size={17} color={colors.white} /><Text style={styles.primaryText}>Pilih tanggal</Text></Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: 'PoppinsMedium', fontSize: 14, color: colors.textSoft },
  field: { minHeight: 50, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldError: { borderColor: colors.danger },
  leadingIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1, fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.text },
  placeholder: { fontFamily: 'PoppinsRegular', color: colors.muted },
  hint: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.muted },
  error: { fontFamily: 'PoppinsRegular', fontSize: 11.5, lineHeight: 17, color: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 35, 55, .32)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modal: { width: '100%', maxWidth: 500, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  modalTitle: { fontFamily: 'PoppinsBold', fontSize: 19, color: colors.text },
  modalCopy: { fontFamily: 'PoppinsRegular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  monthHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  monthTitle: { fontFamily: 'PoppinsSemiBold', fontSize: 14, color: colors.text },
  weekRow: { flexDirection: 'row' },
  weekDay: { width: '14.2857%', textAlign: 'center', fontFamily: 'PoppinsMedium', fontSize: 11, color: colors.muted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 5 },
  dayCell: { width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  dayCellActive: { backgroundColor: colors.primary },
  dayText: { fontFamily: 'PoppinsMedium', fontSize: 13, color: colors.textSoft },
  dayTextActive: { color: colors.white },
  dayTextToday: { color: colors.primary, fontFamily: 'PoppinsBold' },
  disabled: { opacity: 0.28 },
  timeSection: { paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border, gap: 7 },
  timeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timeLabel: { fontFamily: 'PoppinsSemiBold', fontSize: 13, color: colors.text },
  timeInput: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 12, fontFamily: 'PoppinsMedium', fontSize: 14, color: colors.text, backgroundColor: colors.surface },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 2 },
  actionsRight: { flexDirection: 'row', gap: 8 },
  clearButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 5 },
  clearText: { fontFamily: 'PoppinsMedium', fontSize: 12, color: colors.danger },
  secondaryButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.textSoft },
  primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { fontFamily: 'PoppinsSemiBold', fontSize: 12, color: colors.white },
});
