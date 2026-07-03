import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from './theme';

export const Screen = ({ children, scroll, style }) => (
  <SafeAreaView style={[s.screen, style]} edges={['top']}>
    {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>{children}</ScrollView> : children}
  </SafeAreaView>
);

export const H1 = ({ children, style }) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }) => <Text style={[s.h2, style]}>{children}</Text>;
export const P = ({ children, style, ...rest }) => <Text style={[s.p, style]} {...rest}>{children}</Text>;
export const Sub = ({ children, style, ...rest }) => <Text style={[s.sub, style]} {...rest}>{children}</Text>;

export const Card = ({ children, style, onPress }) => {
  const inner = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <TouchableOpacity activeOpacity={0.8} onPress={onPress}>{inner}</TouchableOpacity> : inner;
};

export const Btn = ({ title, onPress, color = C.pink, style, textStyle, disabled }) => (
  <TouchableOpacity
    style={[s.btn, { backgroundColor: disabled ? C.border : color }, style]}
    onPress={onPress} disabled={disabled} activeOpacity={0.85}
  >
    <Text style={[s.btnText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

export const BtnOutline = ({ title, onPress, color = C.blue, style }) => (
  <TouchableOpacity style={[s.btnO, { borderColor: color }, style]} onPress={onPress} activeOpacity={0.85}>
    <Text style={[s.btnText, { color }]}>{title}</Text>
  </TouchableOpacity>
);

export const Input = (props) => (
  <TextInput placeholderTextColor={C.sub} style={[s.input, props.style]} {...props} />
);

export const Chip = ({ label, active, onPress, color = C.pink }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[s.chip, active && { backgroundColor: color, borderColor: color }]}
    activeOpacity={0.8}
  >
    <Text style={[s.chipText, active && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
  </TouchableOpacity>
);

export const Row = ({ children, style }) => <View style={[s.row, style]}>{children}</View>;

export const Badge = ({ label, color = C.blue }) => (
  <View style={[s.badge, { backgroundColor: color + '26', borderColor: color }]}>
    <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 26, fontWeight: '800', marginHorizontal: 16, marginTop: 12 },
  h2: { color: C.text, fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  p: { color: C.text, fontSize: 15 },
  sub: { color: C.sub, fontSize: 13 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginHorizontal: 16, marginVertical: 6, borderWidth: 1, borderColor: C.border },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginVertical: 6 },
  btnO: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginHorizontal: 16, marginVertical: 6, borderWidth: 1.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: { backgroundColor: C.card2, color: C.text, borderRadius: 12, padding: 14, marginHorizontal: 16, marginVertical: 6, fontSize: 15, borderWidth: 1, borderColor: C.border },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, marginRight: 8 },
  chipText: { color: C.sub, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginRight: 6 },
});
