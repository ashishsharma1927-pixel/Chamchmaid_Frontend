import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView, Switch, Image, Platform, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../theme';
import client from '../api/client';
import * as SecureStore from '../utils/storage';
import { safeBack, resetToAuth } from '../utils/navigation';
import { API_URL } from '../config';
import ThemeBackground from '../components/ThemeBackground';

const getImageUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
};

export default function SettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    
    const [profile, setProfile] = useState<any>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [themePref, setThemePref] = useState('system');

    // Toaster state
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastVisible(true);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
        }).start(() => {
            setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true
                }).start(() => setToastVisible(false));
            }, 5000);
        });
    };

    // Profile Completion Logic
    const hasImage = !!profile?.profile_image;
    const hasBio = !!profile?.bio;
    const hasLinks = !!(profile?.social_instagram || profile?.social_twitter || profile?.social_linkedin || profile?.social_youtube || profile?.website);
    const hasCollections = profile?.collections && profile.collections.length > 0;
    
    let completionCount = 0;
    if (hasImage) completionCount++;
    if (hasBio) completionCount++;
    if (hasLinks) completionCount++;
    if (hasCollections) completionCount++;
    const completionPercentage = (completionCount / 4) * 100;

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await client.get('/api/profile/');
            setProfile(response.data);
            setIsPrivate(response.data.is_private || false);
            setThemePref(response.data.theme_preference || 'system');
        } catch (error) {
            console.warn('Failed to fetch profile', error);
            Alert.alert('Error', 'Failed to load settings. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (field: string, value: any) => {
        if (updating) return;
        setUpdating(true);
        
        try {
            await client.put('/api/profile/', { [field]: value });
            // Optimistic update
            if (field === 'is_private') {
                setIsPrivate(value);
                showToast(value ? 'Account is now Private.' : 'Account is now Public.');
            }
            if (field === 'theme_preference') setThemePref(value);
        } catch (error) {
            console.warn(`Failed to update ${field}`, error);
            Alert.alert('Error', 'Failed to save preference. Please try again.');
        } finally {
            setUpdating(false);
        }
    };

    const handleTogglePrivacy = (val: boolean) => {
        if (val) {
            Alert.alert(
                "Switch to Private Account?",
                "If you switch to private, only approved friends will be able to see your posts and send you messages.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Yes, Make Private", onPress: () => updateSetting('is_private', val) }
                ]
            );
        } else {
            Alert.alert(
                "Switch to Public Account?",
                "If you switch to public, anyone can see your profile and posts, and anyone can send you a message.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Yes, Make Public", onPress: () => updateSetting('is_private', val) }
                ]
            );
        }
    };

    const confirmLogout = async () => {
        setShowLogoutModal(false);
        try {
            const refreshToken = await SecureStore.getItemAsync('refresh_token');
            if (refreshToken) {
                await client.post('/api/logout/', { refresh: refreshToken });
            }
        } catch (e) {
            console.warn("Logout API failed", e);
        } finally {
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('refresh_token');
            resetToAuth();
        }
    };

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    if (loading) {
        return (
            <ThemeBackground style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </ThemeBackground>
        );
    }

    const renderProgressBar = () => (
        <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeTitle}>Welcome, {profile?.first_name || profile?.username || 'User'}</Text>
                    <Text style={styles.welcomeSubtitle}>@{profile?.username}</Text>
                </View>
                <View style={styles.avatarWrapper}>
                    <Image 
                        source={{ uri: getImageUrl(profile?.profile_image) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80' }} 
                        style={styles.completionAvatar}
                    />
                    <View style={styles.completionBadge}>
                        <Text style={styles.completionBadgeText}>{completionPercentage}%</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.completeProfileBtn} onPress={() => router.push('/edit-profile')}>
                <Text style={styles.completeProfileBtnText}>Complete Your Profile</Text>
            </TouchableOpacity>

            <View style={styles.checkItem}>
                <Feather name={hasImage ? "check-circle" : "circle"} size={16} color={hasImage ? "#10b981" : "#cbd5e1"} />
                <Text style={[styles.checkText, hasImage && styles.checkTextActive]}>Profile Picture</Text>
            </View>
            <View style={styles.checkItem}>
                <Feather name={hasBio ? "check-circle" : "circle"} size={16} color={hasBio ? "#10b981" : "#cbd5e1"} />
                <Text style={[styles.checkText, hasBio && styles.checkTextActive]}>Basic Info & Bio</Text>
            </View>
            <View style={styles.checkItem}>
                <Feather name={hasLinks ? "check-circle" : "circle"} size={16} color={hasLinks ? "#10b981" : "#cbd5e1"} />
                <Text style={[styles.checkText, hasLinks && styles.checkTextActive]}>Social Links</Text>
            </View>
            <View style={styles.checkItem}>
                <Feather name={hasCollections ? "check-circle" : "circle"} size={16} color={hasCollections ? "#10b981" : "#cbd5e1"} />
                <Text style={[styles.checkText, hasCollections && styles.checkTextActive]}>Collections Setup</Text>
            </View>
        </View>
    );

    return (
        <ThemeBackground>
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <StatusBar style="light" />
                <TouchableOpacity style={styles.backBtn} onPress={() => safeBack('/(tabs)/profile')}>
                    <Feather name="chevron-left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {renderProgressBar()}

                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.settingsGroup}>
                    <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/edit-profile')}>
                        <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                            <Feather name="user" size={16} color="#0284c7" />
                        </View>
                        <Text style={styles.settingLabel}>Edit Profile Details</Text>
                        <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/add-links')}>
                        <View style={[styles.iconBox, { backgroundColor: '#fce7f3' }]}>
                            <Feather name="link" size={16} color="#db2777" />
                        </View>
                        <Text style={styles.settingLabel}>Manage Social Links</Text>
                        <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/manage-collections')}>
                        <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                            <Feather name="grid" size={16} color="#16a34a" />
                        </View>
                        <Text style={styles.settingLabel}>Manage Collections</Text>
                        <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Preferences */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.settingsGroup}>
                    <View style={styles.settingItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                            <Feather name="lock" size={16} color="#9333ea" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>Private Account</Text>
                            <Text style={styles.settingSubLabel}>Only approved followers can see posts.</Text>
                        </View>
                        <Switch
                            value={isPrivate}
                            onValueChange={handleTogglePrivacy}
                            disabled={updating}
                            trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                            thumbColor={'#fff'}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.settingItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#ffedd5' }]}>
                            <Feather name="moon" size={16} color="#ea580c" />
                        </View>
                        <Text style={styles.settingLabel}>App Theme</Text>
                        <View style={styles.themeSelector}>
                            <TouchableOpacity 
                                style={[styles.themeBtn, themePref === 'light' && styles.themeBtnActive]}
                                onPress={() => updateSetting('theme_preference', 'light')}
                            >
                                <Text style={[styles.themeBtnText, themePref === 'light' && styles.themeBtnTextActive]}>Light</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.themeBtn, themePref === 'dark' && styles.themeBtnActive]}
                                onPress={() => updateSetting('theme_preference', 'dark')}
                            >
                                <Text style={[styles.themeBtnText, themePref === 'dark' && styles.themeBtnTextActive]}>Dark</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.themeBtn, themePref === 'system' && styles.themeBtnActive]}
                                onPress={() => updateSetting('theme_preference', 'system')}
                            >
                                <Text style={[styles.themeBtnText, themePref === 'system' && styles.themeBtnTextActive]}>Auto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Recent Activity Mockup */}
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.activityGroup}>
                    <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: '#10b981' }]} />
                        <Text style={styles.activityText}>New login from Windows PC</Text>
                        <Text style={styles.activityTime}>Just now</Text>
                    </View>
                    <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: Colors.dark.primary }]} />
                        <Text style={styles.activityText}>Profile picture updated</Text>
                        <Text style={styles.activityTime}>2h ago</Text>
                    </View>
                    <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: '#8b5cf6' }]} />
                        <Text style={styles.activityText}>Added a new collection</Text>
                        <Text style={styles.activityTime}>Yesterday</Text>
                    </View>
                </View>

                {/* Danger Zone */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Feather name="log-out" size={16} color="#ef4444" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Custom Toaster */}
            {toastVisible && (
                <Animated.View style={[styles.toaster, { opacity: fadeAnim }]}>
                    <Feather name="info" size={20} color="#fff" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.toasterText}>{toastMessage}</Text>
                </Animated.View>
            )}

            <Modal
                visible={showLogoutModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconBox}>
                            <Feather name="log-out" size={24} color={Colors.dark.error} />
                        </View>
                        <Text style={styles.modalTitle}>Log Out?</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to log out of your account?</Text>
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={styles.modalCancelBtn} 
                                onPress={() => setShowLogoutModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.modalLogoutBtn} 
                                onPress={confirmLogout}
                            >
                                <Text style={styles.modalLogoutText}>Log Out</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
        </ThemeBackground>
    );
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    
    // Completion Card Styles
    completionCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        boxShadow: `0px 4px 12px ${Colors.dark.primary}0D`,
        elevation: 2,
    },
    completionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    welcomeTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: Colors.dark.textMuted,
    },
    avatarWrapper: {
        position: 'relative',
    },
    completionAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#e0f2fe',
    },
    completionBadge: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        backgroundColor: Colors.dark.primary,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 2,
        borderColor: Colors.dark.surface,
    },
    completionBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: 'bold',
    },
    completeProfileBtn: {
        backgroundColor: '#e0f2fe',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 20,
    },
    completeProfileBtnText: {
        color: Colors.dark.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    checkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkText: {
        fontSize: 14,
        color: Colors.dark.textMuted,
        marginLeft: 12,
    },
    checkTextActive: {
        color: Colors.dark.text,
        fontWeight: '500',
    },

    // Standard Settings Styles
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 12,
        marginLeft: 4,
    },
    settingsGroup: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    toaster: {
        position: 'absolute',
        bottom: 50,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 9999,
    },
    toasterText: {
        color: '#fff',
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    settingSubLabel: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginLeft: 44,
    },

    // Theme Selector
    themeSelector: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.background,
        borderRadius: 8,
        padding: 4,
    },
    themeBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    themeBtnActive: {
        backgroundColor: Colors.dark.surface,
        boxShadow: '0px 1px 2px #0000001A',
        elevation: 1,
    },
    themeBtnText: {
        fontSize: 13,
        fontWeight: '500',
        color: Colors.dark.textMuted,
    },
    themeBtnTextActive: {
        color: Colors.dark.text,
        fontWeight: 'bold',
    },

    // Activity Feed
    activityGroup: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    activityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 12,
    },
    activityText: {
        flex: 1,
        fontSize: 14,
        color: Colors.dark.text,
    },
    activityTime: {
        fontSize: 12,
        color: Colors.dark.textMuted,
    },

    // Logout
    logoutBtn: {
        backgroundColor: '#451a1a', // Darker red background for dark mode fallback
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        marginBottom: 20,
    },
    logoutText: {
        color: Colors.dark.error,
        fontWeight: 'bold',
        fontSize: 15,
        marginLeft: 8,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
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
        fontWeight: '600',
    },
    modalLogoutBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: Colors.dark.error,
        alignItems: 'center',
    },
    modalLogoutText: {
        color: '#fff',
        fontWeight: '600',
    },
});
