import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../theme';
import client from '../api/client';
import { safeBack } from '../utils/navigation';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from '../utils/storage';
import { API_URL } from '../config';
import ThemeBackground from '../components/ThemeBackground';

export default function EditProfileScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [occupation, setOccupation] = useState('');

    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [newProfileImage, setNewProfileImage] = useState<any>(null);

    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [newCoverImage, setNewCoverImage] = useState<any>(null);

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
                }).start(() => {
                    setToastVisible(false);
                    safeBack('/(tabs)/profile');
                });
            }, 2000);
        });
    };

    const getImageUrl = (url: string | null | undefined, fallback?: string) => {
        if (!url) return fallback || '';
        if (url.startsWith('http') || url.startsWith('file:') || url.startsWith('blob:') || url.startsWith('data:')) return url;
        const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
        const path = url.startsWith('/') ? url : `/${url}`;
        return `${base}${path}`;
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await client.get('/api/profile/');
            const data = response.data;
            
            const first = data.first_name || '';
            const last = data.last_name || '';
            setFullName(`${first} ${last}`.trim());
            
            setUsername(data.username || '');
            setBio(data.bio || '');
            setLocation(data.location || '');
            setOccupation(data.occupation || '');

            setProfileImage(data.profile_image);
            setCoverImage(data.cover_image);
        } catch (error) {
            console.error('Failed to fetch profile', error);
            Alert.alert('Error', 'Failed to load profile details.');
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "Permission to access gallery is required!");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setNewProfileImage(result.assets[0]);
            setProfileImage(result.assets[0].uri);
        }
    };

    const handlePickCoverImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "Permission to access gallery is required!");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setNewCoverImage(result.assets[0]);
            setCoverImage(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        
        try {
            const nameParts = fullName.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Handle image upload if a new image was selected
            if (newProfileImage || newCoverImage) {
                const token = await SecureStore.getItemAsync('access_token');
                
                if (Platform.OS === 'web') {
                    const formData = new FormData();
                    if (newProfileImage?.file) {
                        formData.append('profile_image', newProfileImage.file);
                    }
                    if (newCoverImage?.file) {
                        formData.append('cover_image', newCoverImage.file);
                    }
                    try {
                        await client.put('/api/profile/', formData);
                    } catch (uploadError) {
                        console.error('Image upload failed', uploadError);
                        throw uploadError;
                    }
                } else {
                    if (newProfileImage) {
                        const uploadResult = await FileSystem.uploadAsync(`${API_URL}/api/profile/`, newProfileImage.uri, {
                            fieldName: 'profile_image',
                            httpMethod: 'PUT',
                            uploadType: FileSystem.FileSystemUploadType?.MULTIPART || 1 as any,
                            headers: { Authorization: `Bearer ${token}` },
                            mimeType: newProfileImage.mimeType || 'image/jpeg',
                        });
                        
                        if (uploadResult.status !== 200) {
                            throw new Error("Failed to upload profile image");
                        }
                    }

                    if (newCoverImage) {
                        const uploadResult = await FileSystem.uploadAsync(`${API_URL}/api/profile/`, newCoverImage.uri, {
                            fieldName: 'cover_image',
                            httpMethod: 'PUT',
                            uploadType: FileSystem.FileSystemUploadType?.MULTIPART || 1 as any,
                            headers: { Authorization: `Bearer ${token}` },
                            mimeType: newCoverImage.mimeType || 'image/jpeg',
                        });
                        
                        if (uploadResult.status !== 200) {
                            throw new Error("Failed to upload cover image");
                        }
                    }
                }
            }

            await client.put('/api/profile/', {
                first_name: firstName,
                last_name: lastName,
                username,
                bio,
                location,
                occupation
            });

            showToast('Awesome! Your profile looks great, it has been updated successfully!');
            
            
        } catch (error) {
            console.error('Save failed', error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => safeBack('/(tabs)/profile')}>
                        <Feather name="chevron-left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Edit Profile</Text>
                        <Text style={styles.headerSubtitle}>Make it yours. Show the real you.</Text>
                    </View>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    
                    {/* Cover & Profile Image Section (Simplified) */}
                    <View style={styles.imagesSection}>
                        <View style={styles.coverPhotoPlaceholder}>
                            <Image 
                                source={{ uri: coverImage ? getImageUrl(coverImage) : 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80' }} 
                                style={styles.coverImage} 
                            />
                            <TouchableOpacity style={styles.editCoverBtn} onPress={handlePickCoverImage}>
                                <Feather name="camera" size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.profilePhotoContainer}>
                            <Image 
                                source={{ uri: profileImage ? getImageUrl(profileImage) : 'https://ui-avatars.com/api/?name=User&background=random' }} 
                                style={styles.profileImage} 
                            />
                            <TouchableOpacity style={styles.editPhotoBtn} onPress={handlePickImage}>
                                <Feather name="camera" size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Basic Info */}
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Feather name="user" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Full Name</Text>
                                <TextInput 
                                    style={styles.textInput}
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="Your Name"
                                    maxLength={50}
                                />
                            </View>
                            <Text style={styles.charCount}>{fullName.length}/50</Text>
                        </View>
                        
                        <View style={styles.divider} />

                        <View style={styles.inputGroup}>
                            <Feather name="at-sign" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Username</Text>
                                <TextInput 
                                    style={styles.textInput}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="username"
                                    autoCapitalize="none"
                                    maxLength={30}
                                />
                            </View>
                            <Text style={styles.charCount}>{username.length}/30</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.inputGroup}>
                            <Feather name="file-text" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Bio</Text>
                                <TextInput 
                                    style={styles.bioInput}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="Write a little about yourself..."
                                    multiline
                                    maxLength={150}
                                />
                            </View>
                        </View>
                        <Text style={styles.bioCharCount}>{bio.length}/150</Text>
                    </View>

                    {/* Personal Details */}
                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <Feather name="map-pin" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Location</Text>
                                <TextInput 
                                    style={styles.textInput}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="e.g. Chandigarh, India"
                                />
                            </View>
                        </View>
                        
                        <View style={styles.divider} />

                        <View style={styles.inputGroup}>
                            <Feather name="briefcase" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>Occupation</Text>
                                <TextInput 
                                    style={styles.textInput}
                                    value={occupation}
                                    onChangeText={setOccupation}
                                    placeholder="e.g. Developer"
                                />
                            </View>
                        </View>
                        
                        <View style={styles.divider} />

                    </View>

                    {/* Add Links Option */}
                    <View style={styles.card}>
                        <TouchableOpacity style={[styles.cardHeader, { justifyContent: 'space-between', marginBottom: 0 }]} onPress={() => router.push('/add-links')}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Feather name="link" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                                <View>
                                    <Text style={styles.cardTitle}>Add Links</Text>
                                    <Text style={styles.cardSubtitle}>Connect your other profiles</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: Colors.dark.primary, fontSize: 12, fontWeight: '600', marginRight: 4 }}>Manage</Text>
                                <Feather name="chevron-right" size={12} color={Colors.dark.primary} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Collections Option */}
                    <View style={styles.card}>
                        <TouchableOpacity style={[styles.cardHeader, { justifyContent: 'space-between', marginBottom: 0 }]} onPress={() => router.push('/manage-collections')}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Feather name="grid" size={18} color={Colors.dark.textMuted} style={styles.inputIcon} />
                                <View>
                                    <Text style={styles.cardTitle}>My Collections</Text>
                                    <Text style={styles.cardSubtitle}>Showcase what matters to you</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ color: Colors.dark.primary, fontSize: 12, fontWeight: '600', marginRight: 4 }}>Manage</Text>
                                <Feather name="chevron-right" size={12} color={Colors.dark.primary} />
                            </View>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={{ height: 60 }} />
                </ScrollView>
                
                {/* Custom Toaster */}
                {toastVisible && (
                    <Animated.View style={[styles.toaster, { opacity: fadeAnim }]}>
                        <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.toasterText}>{toastMessage}</Text>
                    </Animated.View>
                )}
            </KeyboardAvoidingView>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
        marginHorizontal: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    helpText: {
        fontSize: 14,
        color: Colors.dark.textMuted,
        flex: 1,
    },
    toaster: {
        position: 'absolute',
        bottom: 50,
        left: 20,
        right: 20,
        backgroundColor: '#10b981', // Success green color
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
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
        lineHeight: 20,
    },
    saveBtn: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 70,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    imagesSection: {
        marginBottom: 24,
        alignItems: 'center',
    },
    coverPhotoPlaceholder: {
        width: '100%',
        height: 120,
        borderRadius: 16,
        backgroundColor: Colors.dark.surface,
        overflow: 'hidden',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    editCoverBtn: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profilePhotoContainer: {
        marginTop: -40,
        alignItems: 'center',
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: Colors.dark.background,
        backgroundColor: Colors.dark.surface,
    },
    editPhotoBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: Colors.dark.primary,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.dark.background,
    },
    card: {
        backgroundColor: Colors.dark.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        boxShadow: '0px 2px 8px #0000000D',
        elevation: 2,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        width: 24,
        textAlign: 'center',
        marginRight: 12,
    },
    inputWrapper: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginBottom: 4,
        fontWeight: '500',
    },
    textInput: {
        fontSize: 14,
        color: Colors.dark.text,
        paddingVertical: 4,
        fontWeight: '500',
    },
    bioInput: {
        fontSize: 14,
        color: Colors.dark.text,
        paddingVertical: 4,
        minHeight: 60,
        textAlignVertical: 'top',
        fontWeight: '500',
    },
    charCount: {
        fontSize: 10,
        color: Colors.dark.textMuted,
        alignSelf: 'flex-end',
    },
    bioCharCount: {
        fontSize: 10,
        color: Colors.dark.textMuted,
        alignSelf: 'flex-end',
        marginTop: -10,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: 12,
        marginLeft: 36,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    cardSubtitle: {
        fontSize: 12,
        color: Colors.dark.textMuted,
    },
    socialGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    socialIconBox: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    socialInputWrapper: {
        flex: 1,
    },
    socialLabel: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginBottom: 2,
        fontWeight: '500',
    },
    socialInput: {
        fontSize: 14,
        color: Colors.dark.text,
        fontWeight: '500',
        paddingVertical: 2,
    },
});
