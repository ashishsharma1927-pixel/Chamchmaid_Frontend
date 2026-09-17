import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import client from '../api/client';
import { setItemAsync } from '../utils/storage';
import { safeBack } from '../utils/navigation';
import { StatusBar } from 'expo-status-bar';
import { cryptoUtils } from '../utils/crypto';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen() {
    const router = useRouter();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
            
            // E2E Encryption: Ensure we have a keypair and upload the public key
            try {
                const { publicKey } = await cryptoUtils.getOrGenerateKeyPair();
                await client.put('/api/profile/', { public_key: publicKey });
            } catch (err) {
                console.warn('Failed to upload public key', err);
            }
            
            router.replace('/(tabs)');
        } catch (error: any) {
            const data = error.response?.data;
            if (data?.is_unverified) {
                Alert.alert('Account Not Verified', 'Please verify your account with the OTP we sent you.');
                router.push(`/verify-otp?identifier=${encodeURIComponent(loginId)}`);
                return;
            }

            console.error('Login error', data || error.message);
            Alert.alert('Login Failed', data?.error || data?.non_field_errors?.[0] || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Welcome Back</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email, Phone, or Username</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter your login ID"
                        placeholderTextColor={Colors.light.textMuted}
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
                        placeholderTextColor={Colors.light.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity style={styles.forgotPassword}>
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
            
            <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                    <Text style={styles.footerLink}>Sign up</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
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
        color: Colors.light.text,
        fontSize: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    form: {
        paddingHorizontal: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: Colors.light.textMuted,
        marginBottom: 8,
        fontSize: 14,
    },
    input: {
        backgroundColor: Colors.light.surface,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 12,
        padding: 16,
        color: Colors.light.text,
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: Colors.light.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    loginButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
        marginBottom: 40,
    },
    footerText: {
        color: Colors.light.textMuted,
    },
    footerLink: {
        color: Colors.light.primary,
        fontWeight: 'bold',
    }
});
