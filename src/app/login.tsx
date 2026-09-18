import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, BackHandler, Modal, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../theme';
import client from '../api/client';
import { setItemAsync, getItemAsync } from '../utils/storage';
import { resetToApp } from '../utils/navigation';
import { StatusBar } from 'expo-status-bar';
import { cryptoUtils } from '../utils/crypto';
import { Feather } from '@expo/vector-icons';
import ThemeBackground from '../components/ThemeBackground';

export default function LoginScreen() {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Toast notification
    const [toastMsg, setToastMsg] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (message: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToastMsg(message);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(2800),
            Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        timerRef.current = setTimeout(() => setToastMsg(''), 3400);
    };

    // Forgot Password State
    const [forgotStep, setForgotStep] = useState(0); // 0=closed, 1=identifier, 2=otp, 3=new password
    const [forgotId, setForgotId] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // If already logged in, redirect straight to tabs
    useEffect(() => {
        getItemAsync('access_token').then(token => {
            if (token) {
                resetToApp();
            }
        });
    }, []);

    // Intercept hardware back button on Android: go to landing page, NEVER pop back to profile/tabs!
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                router.replace('/');
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [router])
    );

    const handleLogin = async () => {
        if (!loginId || !password) {
            Alert.alert('Error', 'Please enter your email/phone/username and password');
            return;
        }

        setLoading(true);
        try {
            const response = await client.post('/api/login/', {
                identifier: loginId,
                password: password
            });

            const { access, refresh, media_key } = response.data;
            await setItemAsync('access_token', access);
            await setItemAsync('refresh_token', refresh);
            if (media_key) {
                await setItemAsync('media_encryption_key', media_key);
            }
            
            // E2E Encryption: Generate keypair and upload public key in the background
            // We don't await this so the user can transition to the app immediately
            cryptoUtils.getOrGenerateKeyPair().then(({ publicKey }) => {
                client.put('/api/profile/', { public_key: publicKey }).catch(err => {
                    console.warn('Failed to upload public key', err);
                });
            }).catch(err => {
                console.warn('Failed to get/generate keypair', err);
            });
            
            // Reset navigation stack so user cannot go back to login
            resetToApp();
        } catch (error: any) {
            const data = error.response?.data;
            if (data?.is_unverified) {
                showToast('Please verify your account with the OTP we sent you.');
                setTimeout(() => router.push(`/verify-otp?identifier=${encodeURIComponent(loginId)}`), 1000);
                return;
            }

            console.warn('Login error', data || error.message);
            const errMsg = data?.error || data?.non_field_errors?.[0] || 'Invalid credentials. Please try again.';
            showToast(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordRequest = async () => {
        if (!forgotId) {
            Alert.alert('Error', 'Please enter your email, phone, or username');
            return;
        }
        setForgotLoading(true);
        try {
            const response = await client.post('/api/forgot-password/', { identifier: forgotId });
            Alert.alert('OTP Sent', response.data.message || 'Check your email/phone for the OTP.');
            setForgotStep(2);
        } catch (error: any) {
            const data = error.response?.data;
            Alert.alert('Error', data?.error || data?.non_field_errors?.[0] || 'Failed to send OTP.');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleForgotOtpContinue = () => {
        if (!forgotOtp) {
            Alert.alert('Error', 'Please enter the OTP');
            return;
        }
        setForgotStep(3);
    };

    const handleResetPassword = async () => {
        if (!forgotNewPassword || !forgotConfirmPassword) {
            Alert.alert('Error', 'Please enter and confirm your new password');
            return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        setForgotLoading(true);
        try {
            await client.post('/api/reset-password/', {
                identifier: forgotId,
                otp: forgotOtp,
                new_password: forgotNewPassword
            });
            Alert.alert('Success', 'Password reset successfully. You can now log in.');
            closeForgotModal();
        } catch (error: any) {
            const data = error.response?.data;
            Alert.alert('Error', data?.error || data?.non_field_errors?.[0] || 'Failed to reset password.');
        } finally {
            setForgotLoading(false);
        }
    };

    const closeForgotModal = () => {
        setForgotStep(0);
        setForgotId('');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
    };

    return (
        <ThemeBackground>
            <SafeAreaView style={styles.container}>
                <StatusBar style="light" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Welcome Back</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email, Phone, or Username</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter your login ID"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={loginId}
                        onChangeText={setLoginId}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />
                </View>

                <TouchableOpacity style={styles.forgotPassword} onPress={() => setForgotStep(1)}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.loginButton} 
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.loginButtonText}>Log In</Text>
                    )}
                </TouchableOpacity>
            </View>
            
            {/* Toast Notification */}
            {toastMsg !== '' && (
                <Animated.View style={[
                    styles.toast,
                    {
                        opacity: toastAnim,
                        transform: [{
                            translateY: toastAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-20, 0],
                            })
                        }]
                    }
                ]}>
                    <Feather name="alert-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.toastText}>{toastMsg}</Text>
                </Animated.View>
            )}

            <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.footerLink}>Sign up</Text>
                </TouchableOpacity>
            </View>
            </SafeAreaView>

            {/* Forgot Password Modal */}
            <Modal visible={forgotStep > 0} animationType="slide" transparent={true} onRequestClose={closeForgotModal}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={closeForgotModal}>
                            <Feather name="x" size={24} color={Colors.dark.textMuted} />
                        </TouchableOpacity>

                        {forgotStep === 1 && (
                            <>
                                <Text style={styles.modalTitle}>Forgot Password</Text>
                                <Text style={styles.modalSubtitle}>Enter your email, phone, or username to receive an OTP.</Text>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Identifier</Text>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="Email / Phone / Username"
                                        placeholderTextColor={Colors.dark.textMuted}
                                        value={forgotId}
                                        onChangeText={setForgotId}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity style={styles.loginButton} onPress={handleForgotPasswordRequest} disabled={forgotLoading}>
                                    {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Send OTP</Text>}
                                </TouchableOpacity>
                            </>
                        )}

                        {forgotStep === 2 && (
                            <>
                                <Text style={styles.modalTitle}>Enter OTP</Text>
                                <Text style={styles.modalSubtitle}>We've sent a code to your account.</Text>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>OTP Code</Text>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="Enter OTP"
                                        placeholderTextColor={Colors.dark.textMuted}
                                        value={forgotOtp}
                                        onChangeText={setForgotOtp}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <TouchableOpacity style={styles.loginButton} onPress={handleForgotOtpContinue}>
                                    <Text style={styles.loginButtonText}>Continue</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {forgotStep === 3 && (
                            <>
                                <Text style={styles.modalTitle}>New Password</Text>
                                <Text style={styles.modalSubtitle}>Create a new password for your account.</Text>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>New Password</Text>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="New Password"
                                        placeholderTextColor={Colors.dark.textMuted}
                                        value={forgotNewPassword}
                                        onChangeText={setForgotNewPassword}
                                        secureTextEntry
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Confirm Password</Text>
                                    <TextInput 
                                        style={styles.input}
                                        placeholder="Confirm Password"
                                        placeholderTextColor={Colors.dark.textMuted}
                                        value={forgotConfirmPassword}
                                        onChangeText={setForgotConfirmPassword}
                                        secureTextEntry
                                    />
                                </View>
                                <TouchableOpacity style={styles.loginButton} onPress={handleResetPassword} disabled={forgotLoading}>
                                    {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Reset Password</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
        marginBottom: 40,
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
    },
    inputGroup: {
        marginBottom: 20,
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
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: Colors.dark.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    toast: {
        position: 'absolute',
        top: 60,
        left: 24,
        right: 24,
        backgroundColor: '#1e1e2e',
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 10,
    },
    toastText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
        marginBottom: 40,
    },
    footerText: {
        color: Colors.dark.textMuted,
    },
    footerLink: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        minHeight: 400,
    },
    modalCloseBtn: {
        alignSelf: 'flex-end',
        padding: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.dark.textMuted,
        marginBottom: 24,
    }
});
