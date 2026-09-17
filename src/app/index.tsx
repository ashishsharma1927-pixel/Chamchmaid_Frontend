import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from '../utils/storage';
import { Colors, Typography } from '../theme';
import { StatusBar } from 'expo-status-bar';

import { cryptoUtils } from '../utils/crypto';
import client from '../api/client';

export default function LandingScreen() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Auto redirect if logged in
        SecureStore.getItemAsync('access_token').then(async token => {
            if (token) {
                // E2E Encryption: Ensure keypair exists and is registered
                try {
                    const { publicKey } = await cryptoUtils.getOrGenerateKeyPair();
                    await client.put('/api/profile/', { public_key: publicKey });
                } catch (err) {
                    console.warn('Failed to upload public key on startup', err);
                }
                router.replace('/(tabs)');
            } else {
                setIsChecking(false);
            }
        });
    }, []);

    if (isChecking) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            
            {/* Background glowing effects can be simulated with absolute views */}
            <View style={[styles.glowBlob, { top: -100, right: -100, backgroundColor: 'rgba(249, 27, 125, 0.2)' }]} />
            <View style={[styles.glowBlob, { bottom: -100, left: -100, backgroundColor: 'rgba(105, 61, 245, 0.2)' }]} />

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image 
                        source={require('../../assets/images/logo.png')} // Replace with actual logo
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.title}>CHAMCHMAID</Text>
                    <Text style={styles.subtitle}>Connect, share, and experience your community like never before.</Text>
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={() => router.push('/login')}
                    >
                        <Text style={styles.primaryButtonText}>Log In</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.secondaryButton}
                        onPress={() => router.push('/signup')}
                    >
                        <Text style={styles.secondaryButtonText}>Create an Account</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        flex: 1,
        justifyContent: 'space-around',
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 40,
    },
    logo: {
        width: 150,
        height: 150,
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
        letterSpacing: 2,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.textMuted,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
        marginBottom: 40,
    },
    primaryButton: {
        backgroundColor: Colors.dark.primary,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        boxShadow: `0px 4px 8px ${Colors.dark.primary}4D`,
        elevation: 5,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    secondaryButtonText: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '600',
    },
    glowBlob: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.5,
    }
});
