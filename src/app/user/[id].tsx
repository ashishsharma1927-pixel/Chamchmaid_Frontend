import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, ImageBackground, SafeAreaView, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme';
import client from '../../api/client';
import { safeBack } from '../../utils/navigation';
import { API_URL } from '../../config';
import { EncryptedMediaImage } from '../../components/EncryptedMediaImage';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

const getImageUrl = (url: string | null | undefined, fallback?: string) => {
    if (!url) return fallback || '';
    if (url.startsWith('http') || url.startsWith('file:') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

const ProfilePostItem = ({ item, index, profile }: { item: any, index: number, profile: any }) => {
    return (
        <View style={[styles.postCardWrapper, index % 2 === 0 ? { marginRight: 8 } : { marginLeft: 8 }]}>
            <TouchableOpacity style={styles.postCard}>
                <EncryptedMediaImage uri={getImageUrl(item.image)} style={styles.postImage} resizeMode="cover" />
                <View style={styles.postOverlay}>
                    <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.postMeta}>
                        <View style={styles.postAuthor}>
                            <Image source={{ uri: getImageUrl(profile?.profile_image, item.image ? getImageUrl(item.image) : undefined) }} style={styles.postAvatar} />
                            <Text style={styles.postTime}>2h ago</Text>
                        </View>
                        <View style={styles.postLikes}>
                            <Feather name="heart" size={12} color="#ef4444" />
                            <Text style={styles.postLikesCount}>{item.likes_count || 0}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

export default function PublicProfileScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const targetId = (Array.isArray(id) ? id[0] : id) || '';

    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [nextUrl, setNextUrl] = useState<string | null>(targetId ? `/api/media/?user_id=${targetId}` : null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const [activeTab, setActiveTab] = useState<'posts'|'connections'>('posts');
    const [connections, setConnections] = useState<any[]>([]);
    const [nextConnectionsUrl, setNextConnectionsUrl] = useState<string | null>(targetId ? `/chat/connections/${targetId}/` : null);
    const [loadingMoreConnections, setLoadingMoreConnections] = useState(false);

    useEffect(() => {
        if (!targetId || targetId === 'undefined') return;
        setNextUrl(`/api/media/?user_id=${targetId}`);
        setNextConnectionsUrl(`/chat/connections/${targetId}/`);
        loadData(targetId);
    }, [targetId]);

    const loadData = async (uid: string) => {
        if (!uid || uid === 'undefined') return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                client.get(`/api/profile/${uid}/`),
                client.get(`/api/media/?user_id=${uid}`),
                client.get(`/chat/connections/${uid}/`)
            ]);
            const [profileRes, postsRes, connectionsRes] = results;
            if (profileRes.status === 'fulfilled') {
                setProfile(profileRes.value.data);
            } else {
                console.error('Failed to load user profile details:', profileRes.reason);
            }
            if (postsRes.status === 'fulfilled') {
                setPosts(postsRes.value.data.results || []);
                setNextUrl(postsRes.value.data.next);
            }
            if (connectionsRes.status === 'fulfilled') {
                setConnections(connectionsRes.value.data.connections || []);
                setNextConnectionsUrl(connectionsRes.value.data.next);
            }
        } catch (error) {
            console.error('Failed to load profile', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMorePosts = async () => {
        if (!nextUrl || loadingMore) return;
        setLoadingMore(true);
        try {
            const endpoint = nextUrl.replace(/^.*\/\/[^\/]+/, '');
            const response = await client.get(endpoint);
            setPosts(prev => [...prev, ...(response.data.results || [])]);
            setNextUrl(response.data.next);
        } catch (error: any) {
            if (error.response?.status === 404 || error.response?.status === 401) {
                setNextUrl(null);
            } else {
                console.error('Failed to load more profile posts', error);
            }
        } finally {
            setLoadingMore(false);
        }
    };

    const fetchMoreConnections = async () => {
        if (!nextConnectionsUrl || loadingMoreConnections) return;
        setLoadingMoreConnections(true);
        try {
            const endpoint = nextConnectionsUrl.replace(/^.*\/\/[^\/]+/, '');
            const response = await client.get(endpoint);
            setConnections(prev => [...prev, ...(response.data.connections || [])]);
            setNextConnectionsUrl(response.data.next);
        } catch (error) {
            console.error('Failed to load more connections', error);
        } finally {
            setLoadingMoreConnections(false);
        }
    };

    const handleDisconnect = async () => {
        if (disconnecting || !targetId) return;
        setDisconnecting(true);
        try {
            await client.post(`/chat/disconnect/${targetId}/`);
            // Refresh profile data to reflect un-friended state
            loadData(targetId);
        } catch (error) {
            console.error('Failed to disconnect', error);
        } finally {
            setDisconnecting(false);
            setShowDisconnectModal(false);
        }
    };

    const displayName = profile?.name || 
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
        profile?.username || 
        (profile?.email ? profile.email.split('@')[0] : (profile?.phone_number || `User ${targetId}`));
    const displayHandle = profile?.username || (profile?.email ? profile.email.split('@')[0] : `user${targetId}`);
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=random`;
    const avatarUri = getImageUrl(profile?.avatar || profile?.profile_image, defaultAvatarUrl);

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {profile?.cover_image ? (
                <ImageBackground 
                    source={{ uri: getImageUrl(profile.cover_image) }} 
                    style={styles.coverImage}
                >
                    <View style={styles.coverOverlay}>
                        <TouchableOpacity style={styles.roundButton} onPress={() => safeBack()}>
                            <Feather name="chevron-left" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </ImageBackground>
            ) : (
                <View style={[styles.coverImage, { backgroundColor: Colors.light.surface }]}>
                    <View style={styles.coverOverlay}>
                        <TouchableOpacity style={[styles.roundButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]} onPress={() => safeBack()}>
                            <Feather name="chevron-left" size={24} color={Colors.light.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
            
            <View style={styles.infoSection}>
                <View style={styles.profileRow}>
                    <View style={styles.avatarContainer}>
                        <Image 
                            source={{ uri: avatarUri }} 
                            style={styles.avatar} 
                        />
                        <View style={styles.verifiedBadge}>
                            <Feather name="check" size={12} color="#fff" />
                        </View>
                    </View>
                </View>

                <View style={styles.nameContainer}>
                    <Text style={styles.name}>{displayName}</Text>
                    <Text style={styles.handle}>@{displayHandle}</Text>
                </View>

                {profile?.bio ? (
                    <Text style={styles.bio}>{profile.bio}</Text>
                ) : null}

                <View style={styles.detailsRow}>
                    {profile?.location ? (
                        <View style={styles.detailItem}>
                            <Feather name="map-pin" size={12} color={Colors.light.textMuted} />
                            <Text style={styles.detailText}>{profile.location}</Text>
                        </View>
                    ) : null}
                    {profile?.occupation ? (
                        <View style={styles.detailItem}>
                            <Feather name="briefcase" size={12} color={Colors.light.textMuted} />
                            <Text style={styles.detailText}>{profile.occupation}</Text>
                        </View>
                    ) : null}
                    {profile?.website ? (
                        <View style={styles.detailItem}>
                            <Feather name="link" size={12} color={Colors.light.textMuted} />
                            <Text style={[styles.detailText, { color: Colors.light.primary }]}>{profile.website}</Text>
                        </View>
                    ) : null}
                </View>

                {!!(profile?.social_instagram || profile?.social_twitter || profile?.social_linkedin || profile?.social_youtube) && (
                    <View style={styles.socialRow}>
                        {profile?.social_instagram && (
                            <View style={[styles.socialIconMini, {backgroundColor: '#fee2e2'}]}>
                                <Feather name="instagram" size={14} color="#e1306c" />
                            </View>
                        )}
                        {profile?.social_twitter && (
                            <View style={[styles.socialIconMini, {backgroundColor: '#f1f5f9'}]}>
                                <Feather name="twitter" size={14} color="#0f1419" />
                            </View>
                        )}
                        {profile?.social_linkedin && (
                            <View style={[styles.socialIconMini, {backgroundColor: '#e0f2fe'}]}>
                                <Feather name="linkedin" size={14} color="#0077b5" />
                            </View>
                        )}
                        {profile?.social_youtube && (
                            <View style={[styles.socialIconMini, {backgroundColor: '#fee2e2'}]}>
                                <Feather name="youtube" size={14} color="#ff0000" />
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: Colors.light.primary, flex: 1 }]} 
                        onPress={() => router.push(`/chat/${targetId}`)}
                    >
                        <Feather name="message-circle" size={16} color="#fff" />
                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>Message</Text>
                    </TouchableOpacity>
                    {profile?.is_friend && (
                        <TouchableOpacity 
                            style={[styles.actionBtn, { flex: 1 }]} 
                            onPress={() => setShowDisconnectModal(true)}
                        >
                            <Feather name="user-minus" size={16} color={Colors.light.error} />
                            <Text style={[styles.actionBtnText, { color: Colors.light.error }]}>Disconnect</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'posts' && styles.activeTab]} 
                        onPress={() => setActiveTab('posts')}
                    >
                        <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                            Posts ({posts?.length || 0})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === 'connections' && styles.activeTab]} 
                        onPress={() => setActiveTab('connections')}
                    >
                        <Text style={[styles.tabText, activeTab === 'connections' && styles.activeTabText]}>
                            Connections ({profile?.friends_count || 0})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            
            <Modal
                visible={showDisconnectModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDisconnectModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Feather name="user-minus" size={24} color={Colors.light.error} />
                        </View>
                        <Text style={styles.modalTitle}>Disconnect User?</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to disconnect from this user? You will no longer be friends and won't be able to chat if they have a private profile.</Text>
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDisconnectModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.modalDeleteBtn} 
                                onPress={handleDisconnect}
                            >
                                {disconnecting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalDeleteText}>Disconnect</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

    const renderEmpty = () => {
        if (profile?.is_private && !profile?.is_friend) {
            return (
                <View style={styles.emptyState}>
                    <View style={styles.emptyStateIcon}>
                        <Feather name="lock" size={32} color={Colors.light.textMuted} />
                    </View>
                    <Text style={styles.emptyStateTitle}>This Account is Private</Text>
                    <Text style={styles.emptyStateSub}>Connect with them to see their posts and connections.</Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                    <Feather name={activeTab === 'posts' ? "image" : "users"} size={32} color={Colors.light.textMuted} />
                </View>
                <Text style={styles.emptyStateTitle}>
                    {activeTab === 'posts' ? "No Posts Yet" : "No Connections Yet"}
                </Text>
                <Text style={styles.emptyStateSub}>
                    {activeTab === 'posts' ? "This user hasn't shared anything." : "This user hasn't connected with anyone."}
                </Text>
            </View>
        );
    };

    const renderPost = ({ item, index }: { item: any, index: number }) => (
        <ProfilePostItem 
            item={item} 
            index={index} 
            profile={profile} 
        />
    );

    const renderConnectionItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.connectionCard}
            onPress={() => router.push(`/user/${item.id}`)}
        >
            <View style={styles.connectionAvatarWrapper}>
                <Image source={{ uri: getImageUrl(item.avatar) }} style={styles.connectionAvatar} />
            </View>
            <View style={styles.connectionInfo}>
                <Text style={styles.connectionName}>{item.name}</Text>
                <Text style={styles.connectionHandle}>@{item.username || 'user'}</Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    if (profile?.is_private && !profile?.is_friend) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <StatusBar style="dark" />
                <View style={styles.headerContainer}>
                    <TouchableOpacity style={[styles.roundButton, { backgroundColor: 'rgba(0,0,0,0.1)', position: 'absolute', top: 50, left: 20, zIndex: 10 }]} onPress={() => safeBack()}>
                        <Feather name="chevron-left" size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                </View>
                <Feather name="lock" size={48} color={Colors.light.textMuted} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: Colors.light.text }}>This account is private</Text>
                <Text style={{ fontSize: 14, color: Colors.light.textMuted, marginTop: 8 }}>You need to be connected to see their posts.</Text>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <FlatList
                data={activeTab === 'posts' ? posts : connections}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                renderItem={activeTab === 'posts' ? renderPost : renderConnectionItem}
                numColumns={activeTab === 'posts' ? 2 : 1}
                key={activeTab}
                columnWrapperStyle={activeTab === 'posts' ? { paddingHorizontal: 24 } : undefined}
                contentContainerStyle={[
                    styles.postsGrid, 
                    ((activeTab === 'posts' && posts.length === 0) || (activeTab === 'connections' && connections.length === 0)) ? styles.emptyListContent : null,
                    activeTab === 'connections' ? { paddingHorizontal: 24 } : null
                ]}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                showsVerticalScrollIndicator={false}
                onEndReached={activeTab === 'posts' ? fetchMorePosts : fetchMoreConnections}
                onEndReachedThreshold={0.5}
                ListFooterComponent={(loadingMore || loadingMoreConnections) ? <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} /> : null}
            />
        </View>
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
    headerContainer: {
        backgroundColor: Colors.light.background,
    },
    coverImage: {
        width: '100%',
        height: 180,
    },
    coverOverlay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
    },
    roundButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoSection: {
        paddingHorizontal: 24,
        marginTop: -40,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: Colors.light.background,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: '#3b82f6',
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.light.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nameContainer: {
        marginBottom: 12,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 2,
    },
    handle: {
        fontSize: 13,
        color: Colors.light.textMuted,
    },
    bio: {
        fontSize: 14,
        color: Colors.light.textMuted,
        lineHeight: 20,
        marginBottom: 16,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        marginBottom: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
        gap: 8,
        justifyContent: 'center',
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 24,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: Colors.light.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.textMuted,
    },
    activeTabText: {
        color: Colors.light.primary,
    },
    connectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        marginBottom: 12,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    connectionAvatarWrapper: {
        marginRight: 12,
    },
    connectionAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    connectionInfo: {
        flex: 1,
    },
    connectionName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 2,
    },
    connectionHandle: {
        fontSize: 13,
        color: Colors.light.textMuted,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        boxShadow: '0px 4px 12px #0000001A',
        elevation: 5,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fee2e2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.light.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.text,
    },
    modalDeleteBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: Colors.light.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDeleteText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 12,
        color: Colors.light.textMuted,
    },
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
    },
    socialIconMini: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    postsGrid: {
        paddingBottom: 40,
    },
    postCardWrapper: {
        width: COLUMN_WIDTH,
        aspectRatio: 0.8,
        marginBottom: 16,
    },
    postCard: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    postImage: {
        width: '100%',
        height: '100%',
    },
    postOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    postTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    postMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    postAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    postAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    postTime: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
    },
    postLikes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    postLikesCount: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    emptyText: {
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 40,
    },
});
