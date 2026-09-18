import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, ImageBackground, ScrollView, SafeAreaView, Switch, Alert, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from '../../utils/storage';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme';
import client from '../../api/client';
import { API_URL } from '../../config';
import { EncryptedMediaImage } from '../../components/EncryptedMediaImage';
import ThemeBackground from '../../components/ThemeBackground';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // 24px padding on each side, gap of 16

const getImageUrl = (url: string | null | undefined, fallback?: string) => {
    if (!url) return fallback || '';
    if (url.startsWith('http') || url.startsWith('file:') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    // Ensure single slash between API_URL and url if needed
    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

const collections = [
    { id: '1', title: 'Travel', items: 24, icon: 'map', image: 'https://images.unsplash.com/photo-1506744626753-1fa44df31c7f?w=400&q=80' },
    { id: '2', title: 'Architecture', items: 12, icon: 'home', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80' },
    { id: '3', title: 'Life', items: 48, icon: 'heart', image: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80' },
];

const tabs = ['Posts', 'Saved', 'Liked'];

const ProfilePostItem = ({ item, index, profile, handleDelete }: { item: any, index: number, profile: any, handleDelete: (id: number) => void }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

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
                            <Text style={styles.postLikesCount}>{item.likes_count || 124}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => setShowMenu(!showMenu)}
            >
                <Feather name="more-horizontal" size={20} color="#fff" />
            </TouchableOpacity>

            {showMenu && (
                <View style={styles.dropdownMenu}>
                    <TouchableOpacity 
                        style={styles.dropdownItem}
                        onPress={() => {
                            setShowMenu(false);
                            setShowDeleteModal(true);
                        }}
                    >
                        <Feather name="trash-2" size={14} color={Colors.dark.error} />
                        <Text style={styles.dropdownText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Modal
                visible={showDeleteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Feather name="trash-2" size={24} color={Colors.dark.error} />
                        </View>
                        <Text style={styles.modalTitle}>Delete Post?</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to delete this post?</Text>
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDeleteModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.modalDeleteBtn} 
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    handleDelete(item.id);
                                }}
                            >
                                <Text style={styles.modalDeleteText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default function ProfileScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [posts, setPosts] = useState<any[]>([]);
    const [nextUrl, setNextUrl] = useState<string | null>('/api/media/?user_id=me');
    const [loadingMore, setLoadingMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Posts');
    const [isPrivate, setIsPrivate] = useState(false);
    const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [profileRes, postsRes] = await Promise.all([
                client.get('/api/profile/'),
                client.get('/api/media/?user_id=me')
            ]);
            setProfile(profileRes.data);
            setIsPrivate(profileRes.data.is_private || false);
            setPosts(postsRes.data.results || []);
            setNextUrl(postsRes.data.next);
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

    const togglePrivacy = async () => {
        if (updatingPrivacy) return;
        setUpdatingPrivacy(true);
        const newValue = !isPrivate;
        // Optimistic UI update
        setIsPrivate(newValue);
        try {
            await client.put('/api/profile/', { is_private: newValue });
        } catch (error) {
            console.error('Failed to update privacy', error);
            // Revert on failure
            setIsPrivate(!newValue);
            alert('Failed to update privacy settings');
        } finally {
            setUpdatingPrivacy(false);
        }
    };

    const handleLogout = async () => {
        try {
            const refreshToken = await SecureStore.getItemAsync('refresh_token');
            if (refreshToken) {
                await client.post('/api/logout/', { refresh: refreshToken });
            }
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
            resetToAuth();
        }
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Cover Image */}
            {profile?.cover_image ? (
                <ImageBackground 
                    source={{ uri: getImageUrl(profile.cover_image) }} 
                    style={styles.coverImage}
                >
                    <View style={styles.coverOverlay}>
                        <View style={{ flex: 1 }} />
                        <View style={styles.rightButtons}>
                            <TouchableOpacity style={styles.roundButton} onPress={() => router.push('/settings')}>
                                <Feather name="settings" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ImageBackground>
            ) : (
                <View style={[styles.coverImage, { backgroundColor: Colors.light.surface }]}>
                    <View style={styles.coverOverlay}>
                        <View style={{ flex: 1 }} />
                        <View style={styles.rightButtons}>
                            <TouchableOpacity style={[styles.roundButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]} onPress={() => router.push('/settings')}>
                                <Feather name="settings" size={20} color={Colors.dark.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
            <View style={styles.infoSection}>
                <View style={styles.profileRow}>
                    <View style={styles.avatarContainer}>
                        <Image 
                            source={{ uri: getImageUrl(profile?.profile_image, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80') }} 
                            style={styles.avatar} 
                        />
                        <View style={styles.verifiedBadge}>
                            <Feather name="check" size={12} color="#fff" />
                        </View>
                    </View>

                    <View style={styles.actionButtonsContainer}>
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.editButton} onPress={() => router.push('/edit-profile')}>
                                <Feather name="edit-2" size={14} color={Colors.dark.text} />
                                <Text style={styles.editButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addUserButton}>
                                <Feather name="user-plus" size={16} color={Colors.dark.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.nameContainer}>
                    <Text style={styles.name}>
                        {profile?.first_name || profile?.username || 'User'} {profile?.last_name || ''}
                    </Text>
                    <Text style={styles.handle}>@{profile?.username || 'user'}</Text>
                </View>

                {profile?.bio ? (
                    <Text style={styles.bio}>{profile.bio}</Text>
                ) : null}

                <View style={styles.detailsRow}>
                    {profile?.location ? (
                        <View style={styles.detailItem}>
                            <Feather name="map-pin" size={12} color={Colors.dark.textMuted} />
                            <Text style={styles.detailText}>{profile.location}</Text>
                        </View>
                    ) : null}
                    {profile?.occupation ? (
                        <View style={styles.detailItem}>
                            <Feather name="briefcase" size={12} color={Colors.dark.textMuted} />
                            <Text style={styles.detailText}>{profile.occupation}</Text>
                        </View>
                    ) : null}
                    {profile?.website ? (
                        <View style={styles.detailItem}>
                            <Feather name="link" size={12} color={Colors.dark.textMuted} />
                            <Text style={[styles.detailText, { color: Colors.dark.primary }]}>{profile.website}</Text>
                        </View>
                    ) : null}
                </View>



                {/* Social Links Row */}
                {!!(profile?.social_instagram || profile?.social_twitter || profile?.social_linkedin || profile?.social_youtube) && (
                    <View style={styles.socialRow}>
                        {profile?.social_instagram ? (
                            <View style={[styles.socialIconMini, {backgroundColor: '#fee2e2'}]}>
                                <Feather name="instagram" size={14} color="#e1306c" />
                            </View>
                        ) : null}
                        {profile?.social_twitter ? (
                            <View style={[styles.socialIconMini, {backgroundColor: '#f1f5f9'}]}>
                                <Feather name="twitter" size={14} color="#0f1419" />
                            </View>
                        ) : null}
                        {profile?.social_linkedin ? (
                            <View style={[styles.socialIconMini, {backgroundColor: '#e0f2fe'}]}>
                                <Feather name="linkedin" size={14} color="#0077b5" />
                            </View>
                        ) : null}
                        {profile?.social_youtube ? (
                            <View style={[styles.socialIconMini, {backgroundColor: '#fee2e2'}]}>
                                <Feather name="youtube" size={14} color="#ff0000" />
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Stats Card */}
                <View style={styles.statsCard}>
                    <View style={styles.statBox}>
                        <View style={styles.statIconBox}>
                            <Feather name="grid" size={16} color={Colors.dark.primary} />
                        </View>
                        <View>
                            <Text style={styles.statValue}>{posts?.length || 0}</Text>
                            <Text style={styles.statLabel}>Posts</Text>
                        </View>
                    </View>
                    <View style={styles.statDivider} />
                    <TouchableOpacity 
                        style={styles.statBox}
                        onPress={() => router.push('/connections')}
                    >
                        <View style={[styles.statIconBox, { backgroundColor: '#e0f2fe' }]}>
                            <Feather name="users" size={16} color="#0284c7" />
                        </View>
                        <View>
                            <Text style={styles.statValue}>{profile?.friends_count || 0}</Text>
                            <Text style={styles.statLabel}>Connections</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Collections (Conditionally Rendered) */}
                {profile?.collections && profile.collections.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>My Collections</Text>
                            <TouchableOpacity>
                                <Text style={styles.seeAllText}>See All <Feather name="chevron-right" size={12} /></Text>
                            </TouchableOpacity>
                        </View>
                        
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={profile.collections}
                            keyExtractor={(item: any) => item.id.toString()}
                            contentContainerStyle={styles.collectionsList}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.collectionCard}>
                                    <Image source={{ uri: item.image || 'https://images.unsplash.com/photo-1506744626753-1fa44df31c7f?w=400&q=80' }} style={styles.collectionImage} />
                                    <View style={styles.collectionInfo}>
                                        <View style={styles.collectionTitleRow}>
                                            <Feather name={item.icon as any || 'folder'} size={12} color={Colors.dark.text} />
                                            <Text style={styles.collectionTitle}>{item.title}</Text>
                                        </View>
                                        <Text style={styles.collectionItems}>{item.items_count} items</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </>
                )}

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    {tabs.map((tab) => (
                        <TouchableOpacity 
                            key={tab} 
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Feather 
                                name={tab === 'Posts' ? 'grid' : tab === 'Saved' ? 'bookmark' : 'heart'} 
                                size={16} 
                                color={activeTab === tab ? Colors.dark.primary : Colors.dark.textMuted} 
                            />
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );

    const handleDeletePost = async (postId: number) => {
        try {
            await client.delete(`/api/media/${postId}/delete/`);
            setPosts(prev => prev.filter(post => post.id !== postId));
        } catch (error) {
            console.error('Failed to delete post', error);
            Alert.alert("Error", "Could not delete the post. Please try again.");
        }
    };

    const renderPost = ({ item, index }: { item: any, index: number }) => (
        <ProfilePostItem 
            item={item} 
            index={index} 
            profile={profile} 
            handleDelete={handleDeletePost} 
        />
    );

    if (loading) {
        return (
            <ThemeBackground style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </ThemeBackground>
        );
    }

    return (
        <ThemeBackground>
            <View style={styles.container}>
                <StatusBar style="light" />
                <FlatList
                    data={posts}
                    keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                    ListHeaderComponent={renderHeader}
                    renderItem={renderPost}
                    numColumns={2}
                    columnWrapperStyle={{ paddingHorizontal: 24 }}
                    contentContainerStyle={styles.postsGrid}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={6}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    onEndReached={fetchMorePosts}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginVertical: 20 }} /> : null}
                    ListEmptyComponent={<Text style={styles.emptyText}>No posts yet.</Text>}
                />
            </View>
        </ThemeBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
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
    rightButtons: {
        flexDirection: 'row',
        gap: 12,
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
        borderColor: Colors.dark.background,
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
        borderColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtonsContainer: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
    },
    nameContainer: {
        marginBottom: 12,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 2,
    },
    handle: {
        fontSize: 13,
        color: Colors.dark.textMuted,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 4,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        gap: 6,
    },
    editButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    addUserButton: {
        padding: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bio: {
        fontSize: 14,
        color: Colors.dark.textMuted,
        lineHeight: 20,
        marginBottom: 16,
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
        color: Colors.dark.textMuted,
    },
    privacyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.dark.surface,
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    privacyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    privacyText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    socialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
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
    statsCard: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginBottom: 24,
        boxShadow: '0px 2px 8px #0000000D',
        elevation: 2,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    statIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#ccfbf1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    statLabel: {
        fontSize: 11,
        color: Colors.dark.textMuted,
    },
    statDivider: {
        width: 1,
        height: '80%',
        backgroundColor: Colors.dark.border,
        alignSelf: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    seeAllText: {
        fontSize: 12,
        color: '#38bdf8',
        fontWeight: '600',
    },
    collectionsList: {
        paddingRight: 24,
        gap: 12,
        marginBottom: 24,
    },
    collectionCard: {
        width: 110,
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    collectionImage: {
        width: '100%',
        height: 60,
    },
    collectionInfo: {
        padding: 10,
    },
    collectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    collectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    collectionItems: {
        fontSize: 10,
        color: Colors.dark.textMuted,
        marginLeft: 18,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: Colors.dark.surface,
        borderRadius: 20,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 8,
        borderRadius: 16,
    },
    activeTab: {
        backgroundColor: Colors.dark.background,
        boxShadow: '0px 1px 2px #0000001A',
        elevation: 1,
    },
    tabText: {
        fontSize: 13,
        color: Colors.dark.textMuted,
        fontWeight: '500',
    },
    activeTabText: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
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
        backgroundColor: 'rgba(0,0,0,0.6)', // Gradient fallback
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
        color: Colors.dark.textMuted,
        textAlign: 'center',
        marginTop: 40,
    },
    deleteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 16,
        padding: 6,
        zIndex: 10,
        elevation: 10,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 40,
        right: 8,
        backgroundColor: Colors.dark.surface,
        borderRadius: 12,
        padding: 4,
        zIndex: 20,
        elevation: 20,
        boxShadow: '0px 4px 12px #00000026',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        paddingRight: 20,
        gap: 8,
    },
    dropdownText: {
        color: Colors.dark.error,
        fontSize: 13,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        boxShadow: '0px 4px 12px #00000026',
        elevation: 20,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#451a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        color: Colors.dark.textMuted,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: Colors.dark.background,
        alignItems: 'center',
    },
    modalCancelText: {
        color: Colors.dark.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalDeleteBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: Colors.dark.error,
        alignItems: 'center',
    },
    modalDeleteText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
