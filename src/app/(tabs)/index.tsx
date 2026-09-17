import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, Animated, TouchableWithoutFeedback, Platform, Alert, Modal, DeviceEventEmitter } from 'react-native';
import client from '../../api/client';
import { Colors } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from '../../utils/storage';
import * as FileSystem from 'expo-file-system/legacy';
import { BlurView } from 'expo-blur';
import { API_URL } from '../../config';
import { EncryptedMediaImage } from '../../components/EncryptedMediaImage';

const { width } = Dimensions.get('window');

const getImageUrl = (url: string | null | undefined, fallback?: string) => {
    if (!url) return fallback || '';
    if (url.startsWith('http') || url.startsWith('file:') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

const PostItem = ({ item, index, toggleLike, handleDelete }: { item: any, index: number, toggleLike: (id: number, index: number) => void, handleDelete: (id: number) => void }) => {
    const [lastTap, setLastTap] = useState<number | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);
    const tapTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (tapTimeout.current) clearTimeout(tapTimeout.current);
        };
    }, []);
    
    // Animation Values
    const scaleValue = useRef(new Animated.Value(0)).current;
    const opacityValue = useRef(new Animated.Value(0)).current;
    const translateYValue = useRef(new Animated.Value(0)).current;
    const rotateValue = useRef(new Animated.Value(0)).current;

    const handleTap = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300; // 300ms window

        if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
                tapTimeout.current = null;
            }
            if (!item.is_liked) {
                toggleLike(item.id, index);
            }
            
            // Reset all animation states
            scaleValue.setValue(0);
            opacityValue.setValue(1);
            translateYValue.setValue(0);
            rotateValue.setValue(0);
            
            // Phase 1: Aggressive Pop & Wiggle
            Animated.parallel([
                Animated.spring(scaleValue, {
                    toValue: 1.2,
                    friction: 3,
                    tension: 60,
                    useNativeDriver: true
                }),
                Animated.sequence([
                    Animated.timing(rotateValue, { toValue: -1, duration: 80, useNativeDriver: true }),
                    Animated.timing(rotateValue, { toValue: 1, duration: 80, useNativeDriver: true }),
                    Animated.timing(rotateValue, { toValue: 0, duration: 80, useNativeDriver: true })
                ])
            ]).start(() => {
                // Phase 2: Settle scale slightly
                Animated.spring(scaleValue, {
                    toValue: 1.0,
                    friction: 5,
                    useNativeDriver: true
                }).start();
                
                // Phase 3: Float up and fade away
                setTimeout(() => {
                    Animated.parallel([
                        Animated.timing(translateYValue, {
                            toValue: -150, // Float upwards
                            duration: 600,
                            useNativeDriver: true
                        }),
                        Animated.timing(opacityValue, {
                            toValue: 0,
                            duration: 500,
                            useNativeDriver: true
                        }),
                        Animated.timing(scaleValue, {
                            toValue: 0.5,
                            duration: 600,
                            useNativeDriver: true
                        })
                    ]).start();
                }, 300);
            });
            
            setLastTap(null);
        } else {
            setLastTap(now);
            tapTimeout.current = setTimeout(() => {
                setShowFullImage(true);
                setLastTap(null);
            }, DOUBLE_PRESS_DELAY);
        }
    };

    const rotation = rotateValue.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-25deg', '25deg']
    });

    const handleProfileNavigation = () => {
        if (item.is_owner) {
            router.push('/profile');
        } else {
            router.push(`/user/${item.user_id}`);
        }
    };

    return (
        <View style={styles.card}>
            <TouchableWithoutFeedback onPress={handleTap}>
                <View style={styles.imageContainer}>
                    <EncryptedMediaImage uri={getImageUrl(item.image)} style={styles.postImage} resizeMode="cover" />
                    
                    {/* Advanced Animated Heart */}
                    <Animated.View style={[
                        styles.bigHeartContainer, 
                        { 
                            opacity: opacityValue,
                            transform: [
                                { translateY: translateYValue },
                                { scale: scaleValue },
                                { rotate: rotation }
                            ] 
                        }
                    ]}>
                        <FontAwesome name="heart" size={50} color="#ef4444" style={styles.heartShadow} />
                    </Animated.View>

                    {/* Author Pill - Top Left */}
                    <TouchableOpacity 
                        style={styles.authorPill}
                        onPress={handleProfileNavigation}
                    >
                        <BlurView intensity={50} tint="dark" style={styles.pillBlur}>
                            {item.author_avatar ? (
                                <Image source={{ uri: item.author_avatar }} style={styles.avatar} />
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <Feather name="user" size={14} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.authorName}>{item.author_name}</Text>
                        </BlurView>
                    </TouchableOpacity>

                    {/* Options Pill - Top Right */}
                    {item.is_owner && (
                        <TouchableOpacity 
                            style={styles.optionsPill}
                            onPress={() => setShowMenu(!showMenu)}
                        >
                            <BlurView intensity={50} tint="dark" style={styles.optionsBlur}>
                                <Feather name="more-horizontal" size={16} color="#fff" />
                            </BlurView>
                        </TouchableOpacity>
                    )}

                    {/* Bottom Overlay - Content & Actions */}
                    <View style={styles.bottomOverlay}>
                        <View style={styles.contentBox}>
                            <BlurView intensity={40} tint="dark" style={styles.contentBlur}>
                                <Text style={styles.postTitle}>{item.title}</Text>
                                {item.subtitle ? (
                                    <Text style={styles.subtitleText} numberOfLines={2}>
                                        {item.subtitle}
                                    </Text>
                                ) : null}
                            </BlurView>
                        </View>

                        <View style={styles.actionsSidebar}>
                            <View style={styles.actionGroup}>
                                <TouchableOpacity 
                                    style={styles.actionButton}
                                    onPress={() => toggleLike(item.id, index)}
                                >
                                    <BlurView intensity={40} tint="dark" style={styles.actionBlur}>
                                        {item.is_liked ? (
                                            <FontAwesome name="heart" size={16} color={Colors.light.error} />
                                        ) : (
                                            <Feather name="heart" size={16} color="#fff" />
                                        )}
                                    </BlurView>
                                </TouchableOpacity>
                                <Text style={styles.actionText}>{item.likes_count}</Text>
                            </View>

                        </View>
                    </View>
                </View>
            </TouchableWithoutFeedback>

            {showMenu && item.is_owner && (
                <View style={styles.dropdownMenu}>
                    <TouchableOpacity 
                        style={styles.dropdownItem}
                        onPress={() => {
                            setShowMenu(false);
                            setShowDeleteModal(true);
                        }}
                    >
                        <Feather name="trash-2" size={16} color={Colors.light.error} />
                        <Text style={styles.dropdownText}>Delete Post</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Custom Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Feather name="trash-2" size={24} color={Colors.light.error} />
                        </View>
                        <Text style={styles.modalTitle}>Delete Post?</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to delete this post? This action cannot be undone.</Text>
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={styles.modalCancelBtn} 
                                onPress={() => setShowDeleteModal(false)}
                            >
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

            {/* Full Screen Image Modal */}
            <Modal
                visible={showFullImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowFullImage(false)}
            >
                <View style={styles.fullScreenOverlay}>
                    {/* Top Header - Author */}
                    <View style={styles.fullScreenHeader}>
                        <TouchableOpacity 
                            style={styles.fullScreenAuthor}
                            onPress={() => {
                                setShowFullImage(false);
                                handleProfileNavigation();
                            }}
                        >
                            {item.author_avatar ? (
                                <Image source={{ uri: item.author_avatar }} style={styles.fullScreenAvatar} />
                            ) : (
                                <View style={styles.fullScreenPlaceholderAvatar}>
                                    <Feather name="user" size={18} color="#fff" />
                                </View>
                            )}
                            <Text style={styles.fullScreenAuthorName}>{item.author_name}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.closeFullImage} 
                            onPress={() => setShowFullImage(false)}
                        >
                            <Feather name="x" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <EncryptedMediaImage 
                        uri={getImageUrl(item.image)} 
                        style={styles.fullScreenImage} 
                        resizeMode="contain" 
                    />

                    {/* Bottom Footer - Description */}
                    <View style={styles.fullScreenFooter}>
                        <Text style={styles.postTitle}>{item.title}</Text>
                        {item.subtitle ? (
                            <Text style={styles.subtitleText}>{item.subtitle}</Text>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default function DashboardScreen() {
    const [posts, setPosts] = useState<any[]>([]);
    const [nextUrl, setNextUrl] = useState<string | null>('/api/media/');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPosts = async (reset = false) => {
        const urlToFetch = reset ? '/api/media/' : nextUrl;
        if (!urlToFetch || loading) return;

        setLoading(true);
        try {
            const endpoint = urlToFetch.replace(/^.*\/\/[^\/]+/, '');
            const response = await client.get(endpoint);
            
            if (reset) {
                setPosts(response.data.results || []);
            } else {
                setPosts(prev => [...prev, ...(response.data.results || [])]);
            }
            setNextUrl(response.data.next);
        } catch (error: any) {
            if (error.response && (error.response.status === 404 || error.response.status === 401)) {
                // If the page doesn't exist or token expired, stop paginating
                setNextUrl(null);
            } else {
                console.error('Failed to load posts', error);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPosts(true);
        const sub = DeviceEventEmitter.addListener('triggerAddPost', handleAddPost);
        return () => sub.remove();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPosts(true);
    };

    const toggleLike = async (postId: number, index: number) => {
        try {
            const res = await client.post(`/api/media/${postId}/like/`);
            const newPosts = [...posts];
            newPosts[index].is_liked = res.data.liked;
            newPosts[index].likes_count = res.data.likes_count;
            setPosts(newPosts);
        } catch (e) {
            console.error('Like error', e);
        }
    };

    const handleAddPost = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                alert("Permission to access gallery is required!");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled) {
                setLoading(true);
                const asset = result.assets[0];
                const token = await SecureStore.getItemAsync('access_token');
                
                if (Platform.OS === 'web') {
                    let fileToUpload: any = (asset as any).file;
                    if (!fileToUpload && asset.uri) {
                        try {
                            const blobRes = await fetch(asset.uri);
                            const blob = await blobRes.blob();
                            fileToUpload = new File([blob], asset.fileName || 'upload.jpg', {
                                type: asset.mimeType || blob.type || 'image/jpeg'
                            });
                        } catch (e) {
                            console.warn('Failed to convert URI to blob:', e);
                        }
                    }

                    const formData = new FormData();
                    if (fileToUpload) {
                        formData.append('image', fileToUpload);
                    }
                    formData.append('title', 'My New Post');

                    const uploadRes = await fetch(`${API_URL}/api/media/`, {
                        method: 'POST',
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: formData
                    });

                    if (!uploadRes.ok) {
                        const errData = await uploadRes.json().catch(() => ({}));
                        throw new Error(errData.error || `Upload failed with status ${uploadRes.status}`);
                    }
                } else {
                    // Robust native mobile upload bypassing React Native's faulty network layer
                    const uploadResult = await FileSystem.uploadAsync(`${API_URL}/api/media/`, asset.uri, {
                        fieldName: 'image',
                        httpMethod: 'POST',
                        uploadType: FileSystem.FileSystemUploadType?.MULTIPART || 1 as any,
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        parameters: {
                            title: 'My New Post'
                        },
                        mimeType: asset.mimeType || 'image/jpeg',
                    });
                    
                    if (uploadResult.status !== 201 && uploadResult.status !== 200) {
                        console.error('Upload failed', uploadResult.body);
                        throw new Error(`Upload failed with status ${uploadResult.status}`);
                    }
                }
                
                onRefresh();
            }
        } catch (error) {
            console.error('Failed to upload', error);
            alert('Failed to upload post');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePost = async (postId: number) => {
        try {
            await client.delete(`/api/media/${postId}/delete/`);
            setPosts(prev => prev.filter(post => post.id !== postId));
        } catch (error) {
            console.error('Failed to delete post', error);
            Alert.alert("Error", "Could not delete the post. Please try again.");
        }
    };

    const renderHeader = () => (
        <View style={styles.sectionHeader}>
            <View style={styles.headerTitleContainer}>
                <Image 
                    source={require('../../../assets/images/logo.png')} 
                    style={styles.headerLogo} 
                />
                <Text style={styles.sectionTitle}>Your World, Here.</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.notificationBtn}>
                <Feather name="bell" size={24} color={Colors.light.text} />
                <View style={styles.notificationBadge} />
            </TouchableOpacity>
        </View>
    );

    const renderPost = ({ item, index }: { item: any, index: number }) => (
        <PostItem item={item} index={index} toggleLike={toggleLike} handleDelete={handleDeletePost} />
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <FlatList
                key="2-columns"
                data={posts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderPost}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContent}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                onEndReached={() => fetchPosts(false)}
                onEndReachedThreshold={0.5}
                refreshing={refreshing}
                onRefresh={onRefresh}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={loading && !refreshing ? <ActivityIndicator size="large" color={Colors.light.primary} style={{margin: 20}} /> : null}
                ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No media uploaded yet.</Text> : null}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    listContent: {
        paddingBottom: 80,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 24,
        marginBottom: 20,
    },
    notificationBtn: {
        padding: 4,
        position: 'relative',
    },
    notificationBadge: {
        position: 'absolute',
        top: 4,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
        borderWidth: 1.5,
        borderColor: Colors.light.background,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLogo: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    viewGalleryText: {
        color: '#38bdf8', // Light blue to match design
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    columnWrapper: {
        paddingHorizontal: 8,
        justifyContent: 'space-between',
    },
    card: {
        flex: 1,
        marginBottom: 16,
        marginHorizontal: 8,
        borderRadius: 20,
        boxShadow: '0px 4px 16px #00000020',
        elevation: 6,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 3/4, 
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: Colors.light.surface,
    },
    postImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    bigHeartContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    heartShadow: {
        textShadowColor: 'rgba(239, 68, 68, 0.5)',
        textShadowOffset: { width: 0, height: 10 },
        textShadowRadius: 20,
    },
    authorPill: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
        borderRadius: 20,
        overflow: 'hidden',
    },
    pillBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 6,
    },
    optionsPill: {
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10,
        borderRadius: 18,
        overflow: 'hidden',
    },
    optionsBlur: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    avatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    placeholderAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    authorName: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        zIndex: 5,
    },
    contentBox: {
        flex: 1,
        marginRight: 8,
        borderRadius: 16,
        overflow: 'hidden',
    },
    contentBlur: {
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    postTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    subtitleText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        lineHeight: 16,
    },
    actionsSidebar: {
        alignItems: 'center',
        gap: 12,
    },
    actionGroup: {
        alignItems: 'center',
        gap: 4,
    },
    actionButton: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    actionBlur: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 50,
        right: 16,
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        padding: 4,
        zIndex: 20,
        elevation: 20,
        boxShadow: '0px 4px 12px #00000026',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingRight: 24,
        gap: 8,
    },
    dropdownText: {
        color: Colors.light.error,
        fontSize: 14,
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
        backgroundColor: Colors.light.surface,
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
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    modalCancelText: {
        color: Colors.light.text,
        fontWeight: '600',
    },
    modalDeleteBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: Colors.light.error,
        alignItems: 'center',
    },
    modalDeleteText: {
        color: '#fff',
        fontWeight: '600',
    },
    fullScreenOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
    },
    fullScreenHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 50,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    fullScreenAuthor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    fullScreenAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    fullScreenPlaceholderAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    fullScreenAuthorName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    fullScreenFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
    closeFullImage: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
    },
    emptyText: {
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 40,
        color: Colors.light.textMuted,
        textAlign: 'center',
        marginTop: 40,
    }
});
