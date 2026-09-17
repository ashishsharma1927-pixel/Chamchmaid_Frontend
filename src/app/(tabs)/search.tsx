import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import client from '../../api/client';
import { Colors } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { API_URL } from '../../config';

const getImageUrl = (url: string) => {
    if (!url) return 'https://ui-avatars.com/api/?name=User&background=random';
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
};

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (text: string) => {
        setQuery(text);
        if (text.length < 2) {
            setUsers([]);
            return;
        }

        setLoading(true);
        try {
            const response = await client.get(`/chat/search/?q=${encodeURIComponent(text)}`);
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Search error', error);
        } finally {
            setLoading(false);
        }
    };

    const sendFriendRequest = async (userId: number, index: number) => {
        try {
            await client.post('/chat/request/send/', { receiver_id: userId });
            const newUsers = [...users];
            newUsers[index].request_sent = true;
            setUsers(newUsers);
        } catch (error) {
            console.error('Failed to send request', error);
        }
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const isDefaultAvatar = !item.avatar || item.avatar.includes('ui-avatars.com');

        return (
            <View style={styles.userCard}>
                <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => router.push(`/user/${item.id}`)}
                >
                    {isDefaultAvatar ? (
                        <View style={[styles.avatar, styles.fallbackAvatar]}>
                            <Feather name="heart" size={20} color="#ef4444" />
                        </View>
                    ) : (
                        <Image source={{ uri: getImageUrl(item.avatar) }} style={styles.avatar} />
                    )}
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.name}</Text>
                        {item.username ? <Text style={styles.userSubtitle}>@{item.username}</Text> : null}
                    </View>
                </TouchableOpacity>
                {item.is_friend ? (
                    <TouchableOpacity 
                        style={[styles.connectButton, { backgroundColor: Colors.light.primary }]}
                        onPress={() => router.push(`/chat/${item.id}`)}
                    >
                        <Text style={styles.connectButtonText}>Message</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        style={[styles.connectButton, item.request_sent && styles.connectButtonDisabled]}
                        onPress={() => sendFriendRequest(item.id, index)}
                        disabled={item.request_sent}
                    >
                        <Text style={styles.connectButtonText}>
                            {item.request_sent ? 'Sent' : 'Connect'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <Text style={styles.title}>Search</Text>
                <View style={styles.searchBar}>
                    <Feather name="search" size={20} color={Colors.light.textMuted} />
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search for people..."
                        placeholderTextColor={Colors.light.textMuted}
                        value={query}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList 
                    data={users}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        query.length >= 2 ? (
                            <Text style={styles.emptyText}>No users found</Text>
                        ) : (
                            <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
                        )
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
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.surface,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        color: Colors.light.text,
        fontSize: 16,
    },
    list: {
        paddingHorizontal: 24,
    },
    userCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.light.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        color: Colors.light.text,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    fallbackAvatar: {
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userSubtitle: {
        color: Colors.light.textMuted,
        fontSize: 13,
    },
    connectButton: {
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    connectButtonDisabled: {
        backgroundColor: Colors.light.textMuted,
    },
    connectButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyText: {
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    }
});
