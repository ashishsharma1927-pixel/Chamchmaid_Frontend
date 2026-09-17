import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, Image } from 'react-native';
import client from '../../api/client';
import { Colors } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { API_URL } from '../../config';

const getImageUrl = (url: string) => {
    if (!url) return 'https://ui-avatars.com/api/?name=User&background=random';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
};

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
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 401) {
                setNextUrl(null);
            }
        } finally {
            setLoading(false);
        }
    };

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
            } else {
                console.error('Failed to load more friends', error);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRequest = async (requestId: number, action: 'accept' | 'reject') => {
        try {
            await client.post('/chat/request/manage/', { 
                request_id: requestId, 
                action: action 
            });
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
        return (
            <TouchableOpacity 
                style={styles.friendCard}
                onPress={() => router.push(`/chat/${item.id}`)}
            >
                {isDefaultAvatar ? (
                    <View style={[styles.avatar, styles.fallbackAvatar]}>
                        <Feather name="heart" size={24} color="#ef4444" />
                    </View>
                ) : (
                    <Image source={{ uri: getImageUrl(item.avatar) }} style={styles.avatar} />
                )}
                <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.name}</Text>
                    <Text style={styles.friendSubtitle}>Tap to chat</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
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
                        <Text style={[styles.sectionTitle, { marginTop: pendingRequests.length ? 20 : 0 }]}>Your Connections</Text>
                    </>
                )}
                contentContainerStyle={styles.list}
                onEndReached={fetchMoreFriends}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} /> : null}
                ListEmptyComponent={<Text style={styles.emptyText}>No connections yet.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    list: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: Colors.light.textMuted,
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 1,
    },
    friendCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    requestCard: {
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 16,
    },
    fallbackAvatar: {
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        color: Colors.light.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    friendSubtitle: {
        color: Colors.light.textMuted,
        fontSize: 14,
    },
    requestInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    requestName: {
        color: Colors.light.text,
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    requestSubtitle: {
        color: Colors.light.textMuted,
        fontSize: 12,
        position: 'absolute',
        top: 20,
        left: 64,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 12,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: Colors.light.success,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    rejectButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    rejectButtonText: {
        color: Colors.light.textMuted,
        fontWeight: 'bold',
    },
    emptyText: {
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    }
});
