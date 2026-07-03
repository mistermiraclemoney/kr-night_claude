import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../store';
import { api } from '../api';
import { C } from '../theme';
import { Screen, Card, Row, P, Sub, Chip, Input, H2, Badge } from '../ui';

export default function SocialScreen({ navigation }) {
  const { t, user, activeCheckin, refreshMe } = useApp();
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [convos, setConvos] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [sent, setSent] = useState({});

  const load = async () => {
    try {
      const [f, r, c] = await Promise.all([
        api('/api/social/friends'), api('/api/social/requests'), api('/api/social/conversations'),
      ]);
      setFriends(f.friends); setRequests(r.requests); setConvos(c.conversations);
      refreshMe();
    } catch (e) {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const doSearch = async (text) => {
    setQuery(text);
    if (text.length < 2) return setResults([]);
    try {
      const { users } = await api(`/api/social/search?handle=${encodeURIComponent(text)}`);
      setResults(users);
    } catch (e) {}
  };

  const sendRequest = async (u) => {
    try {
      const { status } = await api('/api/social/request', { method: 'POST', body: { user_id: u.id } });
      setSent({ ...sent, [u.id]: status });
      if (status === 'accepted') load();
    } catch (e) {}
  };

  const respond = async (req, accept) => {
    await api('/api/social/respond', { method: 'POST', body: { request_id: req.request_id, accept } });
    load();
  };

  return (
    <Screen>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', marginHorizontal: 16, marginTop: 10 }}>💬 Social</Text>
      <Row style={{ marginHorizontal: 16, marginTop: 10 }}>
        <Chip label={`👥 ${t('friends')}`} active={tab === 'friends'} onPress={() => setTab('friends')} />
        <Chip label={`💬 ${t('chats')}`} active={tab === 'chats'} onPress={() => setTab('chats')} />
        <Chip label={`🍸 ${t('lounge')}`} active={tab === 'lounge'} onPress={() => setTab('lounge')} />
      </Row>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}>
        {tab === 'friends' && (
          <>
            <Input placeholder={`🔍 ${t('search_by_handle')}`} value={query} onChangeText={doSearch} autoCapitalize="none" />
            {results.map((u) => (
              <Card key={u.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <P>{u.avatar_emoji} {u.nickname} <Sub>@{u.handle}</Sub></P>
                  <TouchableOpacity onPress={() => sendRequest(u)} style={{ backgroundColor: sent[u.id] ? C.border : C.pink, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      {sent[u.id] === 'accepted' ? '✓' : sent[u.id] ? t('request_sent') : `+ ${t('add_friend')}`}
                    </Text>
                  </TouchableOpacity>
                </Row>
              </Card>
            ))}

            {requests.length > 0 && (
              <>
                <H2>📩 {t('friend_requests')}</H2>
                {requests.map((r) => (
                  <Card key={r.request_id}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <P>{r.avatar_emoji} {r.nickname} <Sub>@{r.handle}</Sub></P>
                      <Row>
                        <TouchableOpacity onPress={() => respond(r, true)} style={{ backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('accept')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => respond(r, false)} style={{ backgroundColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                          <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>{t('decline')}</Text>
                        </TouchableOpacity>
                      </Row>
                    </Row>
                  </Card>
                ))}
              </>
            )}

            <H2>👥 {t('friends')} ({friends.length})</H2>
            {friends.map((f) => (
              <Card key={f.id} onPress={() => navigation.navigate('DM', { user: f })}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <P style={{ fontWeight: '700' }}>{f.avatar_emoji} {f.nickname} <Sub>@{f.handle}</Sub></P>
                    {f.status ? (
                      <Sub style={{ color: C.green, marginTop: 3 }}>📍 {f.status.venue_name}</Sub>
                    ) : (
                      <Sub style={{ marginTop: 3 }}>🌙 offline</Sub>
                    )}
                  </View>
                  <Text style={{ color: C.sub, fontSize: 18 }}>💬</Text>
                </Row>
              </Card>
            ))}
            {friends.length === 0 && <Sub style={{ marginHorizontal: 16, marginTop: 6 }}>{t('no_friends_yet')}</Sub>}
          </>
        )}

        {tab === 'chats' && (
          <>
            {convos.map((c) => (
              <Card key={c.pair} onPress={() => navigation.navigate('DM', { user: { id: c.pair, nickname: c.nickname, handle: c.handle, avatar_emoji: c.avatar_emoji } })}>
                <P style={{ fontWeight: '700' }}>{c.avatar_emoji} {c.nickname}</P>
                <Sub numberOfLines={1} style={{ marginTop: 3 }}>
                  {c.from_user === user.id ? 'You: ' : ''}{c.body}
                </Sub>
              </Card>
            ))}
            {convos.length === 0 && <Sub style={{ margin: 16 }}>—</Sub>}
          </>
        )}

        {tab === 'lounge' && (
          <>
            <H2>🍸 {t('my_lounge')}</H2>
            {activeCheckin ? (
              <Card style={{ borderColor: C.green }} onPress={() => navigation.navigate('Lounge', { venueId: activeCheckin.venue_id, venueName: activeCheckin.venue_name })}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <P style={{ fontWeight: '800', color: C.green }}>📍 {activeCheckin.venue_name}</P>
                    <Sub style={{ marginTop: 3 }}>{t('enter_lounge')} →</Sub>
                  </View>
                  <Badge label="LIVE" color={C.green} />
                </Row>
              </Card>
            ) : (
              <Card><Sub>🔒 {t('no_lounge')}</Sub></Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
