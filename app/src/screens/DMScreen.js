import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, Row, P, Sub, Input } from '../ui';

export default function DMScreen({ route, navigation }) {
  const { user: other } = route.params;
  const { t, user, socket } = useApp();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: `${other.avatar_emoji} ${other.nickname}` });
    api(`/api/social/dm/${other.id}`).then((d) => setMessages(d.messages)).catch(() => {});
    const s = socket();
    const onMsg = (m) => {
      if (m.from_user === other.id || m.to_user === other.id)
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    };
    if (s) s.on('dm:message', onMsg);
    return () => { if (s) s.off('dm:message', onMsg); };
  }, [other.id]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const s = socket();
    if (s) s.emit('dm:send', { toUserId: other.id, body }, (res) => {
      if (res && res.ok) setMessages((prev) => [...prev, res.message]);
    });
  };

  return (
    <Screen style={{ paddingTop: 0 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item: m }) => {
            const mine = m.from_user === user.id;
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 3, marginHorizontal: 12 }}>
                <View style={{ backgroundColor: mine ? C.blue : C.card2, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <P style={{ fontSize: 14 }}>{m.body}</P>
                </View>
              </View>
            );
          }}
        />
        <Row style={{ padding: 8, borderTopWidth: 1, borderColor: C.border }}>
          <Input placeholder={t('type_message')} value={text} onChangeText={setText} style={{ flex: 1, marginVertical: 0, marginHorizontal: 4 }} onSubmitEditing={send} />
          <TouchableOpacity onPress={send} style={{ backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginRight: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('send')}</Text>
          </TouchableOpacity>
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}
