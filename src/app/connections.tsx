import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme';
import client from '../api/client';
import { safeBack } from '../utils/navigation';
import { API_URL } from '../config';

const getImageUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
};

export default function ConnectionsScreen() {
    const router = useRouter();
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [nextUrl, setNextUrl] = useState<string | null>('/chat/connections/');
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const response = await client.get('/chat/connections/');
            setConnections(response.data.connections || []);
            setNextUrl(response.data.next ? `/chat/connections/?cursor=${response.data.next}` : null);
        } catch (error) {
            console.error('Failed to load connections', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMoreConnections = async () => {
        if (!nextUrl || loadingMore) return;
        setLoadingMore(true);
        try {
            const endpoint = nextUrl.replace(/^.*\/\/[^\/]+/, '');
            const response = await client.get(endpoint);
            setConnections(prev => [...prev, ...(response.data.connections || [])]);
            setNextUrl(response.data.next ? `/chat/connections/?cursor=${response.data.next}` : null);
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 401) {
                setNextUrl(null);
            } else {
                console.error('Failed to load more connections', error);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.userCard}>
            <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => router.push(`/user/${item.id}`)}
            >
                {item.avatar ? (
                    <Image source={{ uri: getImageUrl(item.avatar) || undefined }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Feather name="user" size={24} color={Colors.light.textMuted} />
                    </View>
                )}
                <View style={styles.userInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.userName}>{item.name}</Text>
                        {item.is_private && <Feather name="lock" size={12} color={Colors.light.textMuted} />}
                    </View>
                    <Text style={styles.userHandle}>@{item.username || 'user'}</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity 
                style={styles.messageButton}
                onPress={() => router.push(`/chat/${item.id}`)}
            >
                <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Connections</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={connections}
                    keyExtractor={(item, index) => item.id ? item.id.toString() : `conn-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={fetchMoreConnections}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="users" size={48} color={Colors.light.textMuted} />
                            <Text style={styles.emptyText}>No connections yet</Text>
                            <Text style={styles.emptySubText}>When you connect with other users, they will appear here.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    listContent: {
        padding: 16,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
    },
    userHandle: {
        fontSize: 13,
        color: Colors.light.textMuted,
        marginTop: 2,
    },
    messageButton: {
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    messageButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },
});
