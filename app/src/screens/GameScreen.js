import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { useApp } from '../store';
import { C } from '../theme';
import { Screen, Card, Row, P, Sub, Input, Btn, H2 } from '../ui';
import { ICEBREAKERS } from '../i18n';

function Roulette({ t }) {
  const [names, setNames] = useState([]);
  const [input, setInput] = useState('');
  const [winner, setWinner] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const spin = () => {
    if (names.length < 2 || spinning) return;
    setSpinning(true); setWinner(null);
    let i = 0;
    const iv = setInterval(() => { setWinner(names[i % names.length]); i++; }, 90);
    setTimeout(() => {
      clearInterval(iv);
      setWinner(names[Math.floor(Math.random() * names.length)]);
      setSpinning(false);
    }, 2200);
  };

  return (
    <Card>
      <P style={{ fontWeight: '800', fontSize: 16 }}>{t('game_roulette')}</P>
      <Sub style={{ marginTop: 2 }}>{t('game_roulette_desc')}</Sub>
      <Row style={{ marginTop: 10 }}>
        <Input placeholder={t('add_name')} value={input} onChangeText={setInput} style={{ flex: 1, marginHorizontal: 0, marginVertical: 0 }} />
        <TouchableOpacity onPress={() => { if (input.trim()) { setNames([...names, input.trim()]); setInput(''); } }}
          style={{ backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 }}>
          <Text style={{ color: '#fff', fontSize: 20 }}>+</Text>
        </TouchableOpacity>
      </Row>
      <Row style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {names.map((n, i) => (
          <TouchableOpacity key={i} onPress={() => setNames(names.filter((_, j) => j !== i))}
            style={{ backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, margin: 3 }}>
            <Sub>{n} ✕</Sub>
          </TouchableOpacity>
        ))}
      </Row>
      {winner && (
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Text style={{ fontSize: 30 }}>{spinning ? '🎰' : '🍻'}</Text>
          <Text style={{ color: spinning ? C.sub : C.pink, fontSize: 24, fontWeight: '900', marginTop: 4 }}>{winner}</Text>
        </View>
      )}
      <Btn title={t('spin')} onPress={spin} disabled={names.length < 2 || spinning} style={{ marginHorizontal: 0 }} />
    </Card>
  );
}

function Icebreaker({ t, lang }) {
  const cards = ICEBREAKERS[lang] || ICEBREAKERS.en;
  const [idx, setIdx] = useState(null);
  return (
    <Card>
      <P style={{ fontWeight: '800', fontSize: 16 }}>{t('game_ice')}</P>
      <Sub style={{ marginTop: 2 }}>{t('game_ice_desc')}</Sub>
      {idx !== null && (
        <View style={{ backgroundColor: C.card2, borderRadius: 14, padding: 18, marginTop: 12, borderWidth: 1, borderColor: C.purple }}>
          <P style={{ fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{cards[idx]}</P>
        </View>
      )}
      <Btn title={idx === null ? t('start') : t('next_card')} color={C.purple} style={{ marginHorizontal: 0 }}
        onPress={() => setIdx(Math.floor(Math.random() * cards.length))} />
    </Card>
  );
}

function Bomb({ t }) {
  const [state, setState] = useState('idle'); // idle | ticking | boom
  const timer = useRef(null);
  const start = () => {
    setState('ticking');
    const ms = 5000 + Math.random() * 15000;
    timer.current = setTimeout(() => setState('boom'), ms);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Card>
      <P style={{ fontWeight: '800', fontSize: 16 }}>{t('game_bomb')}</P>
      <Sub style={{ marginTop: 2 }}>{t('game_bomb_desc')}</Sub>
      <View style={{ alignItems: 'center', marginVertical: 14 }}>
        {state === 'idle' && <Text style={{ fontSize: 44 }}>💣</Text>}
        {state === 'ticking' && (
          <>
            <Text style={{ fontSize: 44 }}>💣</Text>
            <P style={{ color: C.yellow, marginTop: 6, fontWeight: '700' }}>{t('pass_phone')}</P>
          </>
        )}
        {state === 'boom' && <Text style={{ color: C.danger, fontSize: 22, fontWeight: '900' }}>{t('boom')}</Text>}
      </View>
      <Btn title={state === 'ticking' ? '⏳...' : t('start')} color={C.danger} disabled={state === 'ticking'}
        onPress={() => (state === 'boom' ? setState('idle') : start())} style={{ marginHorizontal: 0 }} />
    </Card>
  );
}

export default function GameScreen() {
  const { t, lang } = useApp();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', marginHorizontal: 16, marginTop: 10 }}>🎲 {t('game_title')}</Text>
        <Roulette t={t} />
        <Icebreaker t={t} lang={lang} />
        <Bomb t={t} />
        <Sub style={{ textAlign: 'center', marginTop: 10, marginHorizontal: 30, fontSize: 11 }}>
          🍺 19+ · Drink responsibly · 즐겁고 안전한 밤 되세요
        </Sub>
      </ScrollView>
    </Screen>
  );
}
