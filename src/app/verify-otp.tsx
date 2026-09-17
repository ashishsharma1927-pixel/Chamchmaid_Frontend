import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../theme';
import client from '../api/client';
import * as SecureStore from 'expo-secure-store';
import { safeBack } from '../utils/navigation';
import { StatusBar } from 'expo-status-bar';

export default function VerifyOTPScreen() {
    const router = useRouter();
    const { identifier } = useLocalSearchParams<{ identifier: string }>();
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    const handleVerify = async () => {
        if (!otp || otp.length < 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit OTP code.');
            return;
        }

        setLoading(true);
        try {
            const response = await client.post('/api/verify/', {
                otp,
                identifier: identifier
            });

            const { access, refresh } = response.data;
            if (access) {
                await SecureStore.setItemAsync('access_token', access);
            }
            if (refresh) {
                await SecureStore.setItemAsync('refresh_token', refresh);
            }
            
            Alert.alert('Success', 'Account verified successfully!', [
                { text: 'Continue', onPress: () => router.replace('/(tabs)') }
            ]);
        } catch (error: any) {
            const errMsg = error.response?.data?.error || 'Verification failed. Invalid OTP.';
            Alert.alert('Verification Failed', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        try {
            await client.post('/api/resend-otp/', { identifier });
            Alert.alert('Sent', 'A new OTP has been sent to your email or phone.');
        } catch (error: any) {
            const errMsg = error.response?.data?.error || 'Failed to resend OTP.';
            Alert.alert('Error', errMsg);
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Verify Account</Text>
                <Text style={styles.subtitle}>We've sent a 6-digit verification code to your email/phone.</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="Enter 6-digit code"
                        placeholderTextColor={Colors.light.textMuted}
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                </View>

                <TouchableOpacity 
                    style={styles.verifyButton} 
                    onPress={handleVerify}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.verifyButtonText}>Verify Now</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Didn't receive the code? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                        {resendLoading ? (
                            <ActivityIndicator size="small" color={Colors.light.primary} />
                        ) : (
                            <Text style={styles.footerLink}>Resend OTP</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.light.textMuted,
        lineHeight: 24,
    },
    form: {
        paddingHorizontal: 24,
    },
    inputGroup: {
        marginBottom: 30,
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
        fontSize: 20,
        textAlign: 'center',
        letterSpacing: 8,
        fontWeight: 'bold',
    },
    verifyButton: {
        backgroundColor: Colors.light.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyButtonText: {
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
        color: Colors.light.textMuted,
    },
    footerLink: {
        color: Colors.light.primary,
        fontWeight: 'bold',
    }
});
