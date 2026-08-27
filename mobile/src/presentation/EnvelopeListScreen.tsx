import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import type { StoredEnvelope } from '../domain/payroll';
import { deleteEnvelope, listEnvelopes } from '../infrastructure/envelopeRepository';
import { EnvelopeView } from './EnvelopeView';
import { colors } from './theme';

export function EnvelopeListScreen({ revision }: { revision: number }) {
  const db = useSQLiteContext();
  const [items, setItems] = useState<StoredEnvelope[]>([]);
  const [selected, setSelected] = useState<StoredEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useEffect(() => {
    let current = true; setLoading(true);
    void listEnvelopes(db).then((result) => { if (current) setItems(result); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [db, revision]);

  const confirmDelete = (item: StoredEnvelope, close: () => void) => {
    Alert.alert(
      'Eliminar comprobante',
      `¿Desea eliminar la planilla ${item.consecutive} del ${item.dateFrom} al ${item.dateTo}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: close },
        {
          text: 'Eliminar', style: 'destructive', onPress: () => {
            setDeletingId(item.id);
            void deleteEnvelope(db, item.id)
              .then(() => setItems((current) => current.filter(({ id }) => id !== item.id)))
              .catch(() => { close(); Alert.alert('No se pudo eliminar', 'Intente nuevamente.'); })
              .finally(() => setDeletingId(null));
          }
        }
      ]
    );
  };

  if (selected) return <EnvelopeView stored={selected} onBack={() => setSelected(null)}/>;
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.green}/><Text style={styles.muted}>Cargando sobres…</Text></View>;
  return <View style={styles.screen}>
    <View style={styles.intro}><Text style={styles.eyebrow}>HISTORIAL LOCAL</Text><Text style={styles.heading}>Planillas guardadas</Text><Text style={styles.description}>Toque para ver el comprobante o deslice hacia la izquierda para eliminar.</Text></View>
    <View style={styles.tableHeader}><Text style={styles.rangeColumn}>Rango de fecha</Text><Text style={styles.consecutiveColumn}>Consecutivo</Text></View>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={items.length ? styles.list : styles.emptyList}
      renderItem={({ item }) => <SwipeableEnvelopeRow item={item} deleting={deletingId === item.id}
        onOpen={() => setSelected(item)} onDelete={(close) => confirmDelete(item, close)}/>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={40} color={colors.green}/></View><Text style={styles.emptyTitle}>Aún no hay sobres</Text><Text style={styles.muted}>Use la pestaña Escanear para guardar su primer comprobante.</Text></View>}/>
  </View>;
}

const DELETE_WIDTH = 104;

function SwipeableEnvelopeRow({ item, deleting, onOpen, onDelete }: {
  item: StoredEnvelope;
  deleting: boolean;
  onOpen(): void;
  onDelete(close: () => void): void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const moveTo = (value: number) => {
    open.current = value !== 0;
    Animated.spring(translateX, { toValue: value, useNativeDriver: true, tension: 90, friction: 12 }).start();
  };
  const close = () => moveTo(0);
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => {
      const origin = open.current ? -DELETE_WIDTH : 0;
      translateX.setValue(Math.max(-DELETE_WIDTH, Math.min(0, origin + gesture.dx)));
    },
    onPanResponderRelease: (_, gesture) => {
      const origin = open.current ? -DELETE_WIDTH : 0;
      const finalPosition = origin + gesture.dx;
      moveTo(gesture.vx < -0.35 || finalPosition < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
    },
    onPanResponderTerminate: close
  })).current;

  return <View style={styles.swipeContainer}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar planilla ${item.consecutive}`}
      disabled={deleting} style={styles.deleteAction} onPress={() => onDelete(close)}>
      {deleting ? <ActivityIndicator color="white"/> : <Ionicons name="trash-outline" size={23} color="white"/>}
      <Text style={styles.deleteText}>{deleting ? 'Eliminando' : 'Eliminar'}</Text>
    </Pressable>
    <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
      <Pressable style={styles.item} onPress={() => open.current ? close() : onOpen()}
        accessibilityRole="button" accessibilityHint="Deslice hacia la izquierda para eliminar"
        accessibilityActions={[{ name: 'activate' }, { name: 'delete', label: 'Eliminar comprobante' }]}
        onAccessibilityAction={({ nativeEvent }) => nativeEvent.actionName === 'delete' ? onDelete(close) : onOpen()}>
        <View style={styles.rangeColumn}><Text style={styles.range}>{item.dateFrom} — {item.dateTo}</Text><Text style={styles.employee}>{item.employeeName}</Text></View>
        <Text style={styles.consecutiveColumn}>{item.consecutive}</Text><Ionicons name="chevron-forward" size={20} color={colors.green}/>
      </Pressable>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, intro: { padding: 20, paddingBottom: 16 }, eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heading: { marginTop: 5, color: colors.text, fontSize: 25, fontWeight: '800' }, description: { marginTop: 5, color: colors.muted, fontSize: 13 },
  tableHeader: { marginHorizontal: 15, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', borderTopLeftRadius: 11, borderTopRightRadius: 11, backgroundColor: '#dce7eb' },
  rangeColumn: { flex: 1 }, consecutiveColumn: { width: 85, color: colors.text, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  list: { marginHorizontal: 15, paddingBottom: 25, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, backgroundColor: 'white' },
  swipeContainer: { overflow: 'hidden', backgroundColor: '#c62828' },
  deleteAction: { position: 'absolute', top: 0, right: 0, bottom: 0, width: DELETE_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#c62828' },
  deleteText: { color: 'white', fontSize: 11, fontWeight: '800' },
  item: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5ecef', backgroundColor: 'white' },
  range: { color: colors.text, fontSize: 14, fontWeight: '700' }, employee: { marginTop: 5, color: colors.muted, fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { maxWidth: 280, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyList: { flexGrow: 1 }, empty: { flex: 1, padding: 38, alignItems: 'center', justifyContent: 'center' }, emptyIcon: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#dff3ec' },
  emptyTitle: { marginTop: 16, marginBottom: 7, color: colors.text, fontSize: 20, fontWeight: '800' }
});
