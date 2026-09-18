import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, ScrollView, Image, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import client from '../api/client';
import { Colors } from '../theme';
import * as ImagePicker from 'expo-image-picker';
import { safeBack } from '../utils/navigation';
import { StatusBar } from 'expo-status-bar';
import ThemeBackground from '../components/ThemeBackground';

export default function SignupScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [newProfileImage, setNewProfileImage] = useState<any>(null);
    const [loading, setLoading] = useState(false);

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
            }, 6000);
        });
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

    const handleSignup = async () => {
        if (!email || !password || !username || !confirmPassword) {
            showToast('Please fill in all required fields');
            return;
        }

        if (username.includes(' ')) {
            showToast('Username cannot contain spaces');
            return;
        }

        if (username.length > 25) {
            showToast('Username cannot be more than 25 characters');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Password does not match confirm password');
            return;
        }

        setLoading(true);
        try {
            if (newProfileImage && Platform.OS === 'web') {
                const formData = new FormData();
                formData.append('username', username);
                formData.append('email', email);
                formData.append('password', password);
                if (bio) formData.append('bio', bio);
                formData.append('profile_image', newProfileImage.file);

                await client.post('/api/signup/', formData);
            } else {
                // Wait, if it's mobile and there is an image, we should probably just send JSON because FileSystem.uploadAsync is hard here without token
                // Actually, FormData works fine on mobile too for basic multipart requests in Axios
                if (newProfileImage) {
                    const formData = new FormData();
                    formData.append('username', username);
                    formData.append('email', email);
                    formData.append('password', password);
                    if (bio) formData.append('bio', bio);
                    formData.append('profile_image', {
                        uri: newProfileImage.uri,
                        name: 'profile.jpg',
                        type: newProfileImage.mimeType || 'image/jpeg'
                    } as any);
                    
                    await client.post('/api/signup/', formData);
                } else {
                    await client.post('/api/signup/', {
                        username,
                        email,
                        password,
                        bio
                    });
                }
            }

            // Navigate immediately to verify-otp screen
            router.push(`/verify-otp?identifier=${encodeURIComponent(email || username)}`);
        } catch (error: any) {
            const data = error.response?.data;
            let errMsg = 'Registration failed. Please try again.';
            
            if (data && typeof data === 'object') {
                if (data.email) errMsg = Array.isArray(data.email) ? data.email[0] : data.email;
                else if (data.phone_number) errMsg = Array.isArray(data.phone_number) ? data.phone_number[0] : data.phone_number;
                else if (data.username) errMsg = Array.isArray(data.username) ? data.username[0] : data.username;
                else if (data.password) errMsg = Array.isArray(data.password) ? data.password[0] : data.password;
                else if (data.non_field_errors) errMsg = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
                else if (data.error) errMsg = data.error;
                else if (data.detail) errMsg = data.detail;
                else {
                    // Grab the very first value from the object if it's an unexpected field
                    const firstKey = Object.keys(data)[0];
                    if (firstKey && data[firstKey]) {
                        errMsg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
                    } else {
                        errMsg = 'Registration failed. Please try again.';
                    }
                }
            } else if (error.message) {
                errMsg = error.message;
            }
            
            showToast(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar style="light" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Create Account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                
                <View style={styles.profilePhotoContainer}>
                    <Image 
                        source={{ uri: profileImage ? profileImage : 'https://ui-avatars.com/api/?name=User&background=random' }} 
                        style={styles.profileImage} 
                    />
                    <TouchableOpacity style={styles.editPhotoBtn} onPress={handlePickImage}>
                        <Feather name="camera" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Choose a username"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Create a strong password"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Re-enter your password"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio (Optional)</Text>
                    <TextInput 
                        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                        placeholder="Tell us a little about yourself"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        maxLength={150}
                    />
                </View>

                <TouchableOpacity 
                    style={styles.signupButton} 
                    onPress={handleSignup}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.signupButtonText}>Sign Up</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.replace('/login')}>
                        <Text style={styles.footerLink}>Log in</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            
            {/* Custom Toaster */}
            {toastVisible && (
                <Animated.View style={[styles.toaster, { opacity: fadeAnim }]}>
                    <Feather name="info" size={20} color="#fff" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.toasterText}>{toastMessage}</Text>
                </Animated.View>
            )}
            
            </SafeAreaView>
        </ThemeBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        marginBottom: 30,
    },
    backButton: {
        marginBottom: 20,
    },
    backButtonText: {
        color: Colors.dark.text,
        fontSize: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    form: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    profilePhotoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: Colors.dark.surface,
        backgroundColor: Colors.dark.background,
    },
    editPhotoBtn: {
        position: 'absolute',
        bottom: 0,
        right: '35%',
        backgroundColor: Colors.dark.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.dark.background,
    },
    inputGroup: {
        marginBottom: 20,
    },
    toaster: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: Colors.dark.error || '#ef4444',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 9999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    toasterText: {
        color: '#fff',
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    label: {
        color: Colors.dark.textMuted,
        marginBottom: 8,
        fontSize: 14,
    },
    input: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 12,
        padding: 16,
        color: Colors.dark.text,
        fontSize: 16,
    },
    signupButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 40,
    },
    footerText: {
        color: Colors.dark.textMuted,
    },
    footerLink: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
    }
});
