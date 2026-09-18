import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, DeviceEventEmitter } from 'react-native';
import client from '../../api/client';
import { Colors } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ThemeBackground from '../../components/ThemeBackground';
import { API_URL } from '../../config';

const getImageUrl = (url: string) => {
    if (!url) return 'https://ui-avatars.com/api/?name=User&background=random';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
};

function formatTime(isoString: string | null): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
    const router = useRouter();
    const [friends, setFriends] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextUrl, setNextUrl] = useState<string | null>('/chat/api/messages_data/');
    const [loadingMore, setLoadingMore] = useState(false);

    const loadData = async () => {
        try {
            const res = await client.get('/chat/api/messages_data/');
            setFriends(res.data.friends || []);
            setPendingRequests(res.data.pending_requests || []);
            setNextUrl(res.data.next ? `/chat/api/messages_data/?cursor=${res.data.next}` : null);

            // Compute total unread senders and broadcast to nav bar
            const unreadSenders = (res.data.friends || []).filter((f: any) => f.unread_count > 0).length;
            DeviceEventEmitter.emit('unreadCountUpdate', { count: unreadSenders });
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 401) {
                setNextUrl(null);
            }
        } finally {
            setLoading(false);
        }
    };

    // Refresh every time the tab comes into focus
    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadData();
        }, [])
    );

    const fetchMoreFriends = async () => {
        if (!nextUrl || loadingMore) return;
        setLoadingMore(true);
        try {
            const endpoint = nextUrl.replace(/^.*\/\/[^\/]+/, '');
            const res = await client.get(endpoint);
            setFriends(prev => [...prev, ...(res.data.friends || [])]);
            setNextUrl(res.data.next ? `/chat/api/messages_data/?cursor=${res.data.next}` : null);
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 401) {
                setNextUrl(null);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    const handleRequest = async (requestId: number, action: 'accept' | 'reject') => {
        try {
            await client.post('/chat/request/manage/', { request_id: requestId, action });
            loadData();
        } catch (e) {
            console.error('Failed to handle request', e);
        }
    };

    const renderRequest = ({ item }: { item: any }) => {
        const isDefaultAvatar = !item.avatar || item.avatar.includes('ui-avatars.com');
        return (
            <View style={styles.requestCard}>
                {isDefaultAvatar ? (
                    <View style={[styles.avatar, styles.fallbackAvatar]}>
                        <Feather name="heart" size={24} color="#ef4444" />
                    </View>
                ) : (
                    <Image source={{ uri: getImageUrl(item.avatar) }} style={styles.avatar} />
                )}
                <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{item.name}</Text>
                    <Text style={styles.requestSubtitle}>Sent a connection request</Text>
                </View>
                <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => handleRequest(item.request_id, 'accept')}>
                        <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectButton} onPress={() => handleRequest(item.request_id, 'reject')}>
                        <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderFriend = ({ item }: { item: any }) => {
        const isDefaultAvatar = !item.avatar || item.avatar.includes('ui-avatars.com');
        const hasUnread = item.unread_count > 0;

        return (
            <TouchableOpacity
                style={[styles.friendCard, hasUnread && styles.friendCardUnread]}
                onPress={() => router.push(`/chat/${item.id}`)}
                activeOpacity={0.75}
            >
                {/* Avatar */}
                <View style={styles.avatarWrapper}>
                    {isDefaultAvatar ? (
                        <View style={[styles.avatar, styles.fallbackAvatar]}>
                            <Feather name="heart" size={22} color="#ef4444" />
                        </View>
                    ) : (
                        <Image source={{ uri: getImageUrl(item.avatar) }} style={styles.avatar} />
                    )}
                    {hasUnread && <View style={styles.onlineDot} />}
                </View>

                {/* Name + last message */}
                <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, hasUnread && styles.friendNameUnread]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text
                        style={[styles.friendSubtitle, hasUnread && styles.friendSubtitleUnread]}
                        numberOfLines={1}
                    >
                        {item.last_message || 'Tap to chat'}
                    </Text>
                </View>

                {/* Time + unread badge */}
                <View style={styles.metaCol}>
                    {item.last_message_time ? (
                        <Text style={[styles.timeText, hasUnread && styles.timeTextUnread]}>
                            {formatTime(item.last_message_time)}
                        </Text>
                    ) : null}
                    {hasUnread && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                                {item.unread_count > 99 ? '99+' : item.unread_count}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <ThemeBackground style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </ThemeBackground>
        );
    }

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.header}>
                    <Text style={styles.title}>Messages</Text>
                </View>

                <FlatList
                    data={friends}
                    keyExtractor={(item, index) => item.id ? item.id.toString() : `friend-${index}`}
                    renderItem={renderFriend}
                    ListHeaderComponent={() => (
                        <>
                            {pendingRequests.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Pending Requests</Text>
                                    {pendingRequests.map((req) => (
                                        <View key={`req-${req.request_id}`}>
                                            {renderRequest({ item: req })}
                                        </View>
                                    ))}
                                </View>
                            )}
                            <Text style={[styles.sectionTitle, { marginTop: pendingRequests.length ? 20 : 0 }]}>
                                Your Connections
                            </Text>
                        </>
                    )}
                    contentContainerStyle={styles.list}
                    onEndReached={fetchMoreFriends}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={<Text style={styles.emptyText}>No connections yet.</Text>}
                />
            </SafeAreaView>
        </ThemeBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 24, paddingBottom: 8 },
    title: { fontSize: 28, fontWeight: 'bold', color: Colors.dark.text },
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    section: { marginBottom: 20 },
    sectionTitle: {
        color: Colors.dark.textMuted,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 1,
        paddingHorizontal: 4,
    },

    // Friend row
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    friendCardUnread: {
        borderColor: Colors.dark.primary + '40',
        backgroundColor: Colors.dark.surface,
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 14,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    fallbackAvatar: {
        backgroundColor: '#451a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.dark.primary,
        borderWidth: 2,
        borderColor: Colors.dark.surface,
    },
    friendInfo: { flex: 1, justifyContent: 'center' },
    friendName: {
        color: Colors.dark.text,
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 3,
    },
    friendNameUnread: {
        fontWeight: '700',
    },
    friendSubtitle: {
        color: Colors.dark.textMuted,
        fontSize: 13,
    },
    friendSubtitleUnread: {
        color: Colors.dark.text,
        fontWeight: '500',
    },
    metaCol: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
        minWidth: 42,
    },
    timeText: {
        color: Colors.dark.textMuted,
        fontSize: 11,
    },
    timeTextUnread: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    unreadBadge: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },

    // Pending request card
    requestCard: {
        backgroundColor: Colors.dark.surface,
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
    },
    requestInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    requestName: {
        color: Colors.dark.text,
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
    },
    requestSubtitle: {
        color: Colors.dark.textMuted,
        fontSize: 12,
        position: 'absolute',
        top: 20,
        left: 64,
    },
    requestActions: { flexDirection: 'row', gap: 10 },
    acceptButton: {
        flex: 1,
        backgroundColor: Colors.dark.success,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    rejectButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    rejectButtonText: { color: Colors.dark.textMuted, fontWeight: 'bold', fontSize: 13 },
    emptyText: { color: Colors.dark.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
});
