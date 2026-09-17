import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme';
import client from '../api/client';
import { safeBack } from '../utils/navigation';

export default function AddLinksScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [instagram, setInstagram] = useState('');
    const [twitter, setTwitter] = useState('');
    const [linkedin, setLinkedin] = useState('');
    const [youtube, setYoutube] = useState('');
    const [website, setWebsite] = useState('');

    const [instagramEnabled, setInstagramEnabled] = useState(false);
    const [twitterEnabled, setTwitterEnabled] = useState(false);
    const [linkedinEnabled, setLinkedinEnabled] = useState(false);
    const [youtubeEnabled, setYoutubeEnabled] = useState(false);
    const [websiteEnabled, setWebsiteEnabled] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await client.get('/api/profile/');
            const data = response.data;
            
            setInstagram(data.social_instagram || '');
            setInstagramEnabled(!!data.social_instagram);
            
            setTwitter(data.social_twitter || '');
            setTwitterEnabled(!!data.social_twitter);
            
            setLinkedin(data.social_linkedin || '');
            setLinkedinEnabled(!!data.social_linkedin);
            
            setYoutube(data.social_youtube || '');
            setYoutubeEnabled(!!data.social_youtube);
            
            setWebsite(data.website || '');
            setWebsiteEnabled(!!data.website);
        } catch (error) {
            console.error('Failed to fetch profile', error);
            Alert.alert('Error', 'Failed to load profile details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        
        try {
            await client.put('/api/profile/', {
                social_instagram: instagramEnabled ? instagram : '',
                social_twitter: twitterEnabled ? twitter : '',
                social_linkedin: linkedinEnabled ? linkedin : '',
                social_youtube: youtubeEnabled ? youtube : '',
                website: websiteEnabled ? website : ''
            });

            Alert.alert('Success', 'Social links updated successfully', [
                { text: 'OK', onPress: () => safeBack('/edit-profile') }
            ]);
            
        } catch (error) {
            console.error('Save failed', error);
            Alert.alert('Error', 'Failed to update links. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    const renderLinkInput = (
        icon: string, 
        iconColor: string, 
        iconBg: string, 
        label: string, 
        placeholder: string,
        value: string, 
        setValue: (v: string) => void, 
        enabled: boolean, 
        setEnabled: (v: boolean) => void
    ) => (
        <View style={styles.linkGroup}>
            <View style={[styles.socialIconBox, { backgroundColor: iconBg }]}>
                <Feather name={icon as any} size={18} color={iconColor} />
            </View>
            <View style={styles.inputWrapper}>
                <View style={styles.labelRow}>
                    <Text style={styles.linkLabel}>{label}</Text>
                    <Switch
                        value={enabled}
                        onValueChange={setEnabled}
                        trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                        thumbColor={'#fff'}
                    />
                </View>
                {enabled && (
                    <TextInput 
                        style={styles.linkInput}
                        value={value}
                        onChangeText={setValue}
                        placeholder={placeholder}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => safeBack('/edit-profile')}>
                        <Feather name="x" size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.titleSection}>
                        <View style={styles.iconCircle}>
                            <Feather name="link" size={24} color={Colors.light.primary} />
                        </View>
                        <Text style={styles.headerTitle}>Add Links</Text>
                        <Text style={styles.headerSubtitle}>
                            Connect your world. Add links to your social profiles, website or anything you want to share.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        {renderLinkInput('instagram', '#e1306c', '#fee2e2', 'Instagram', 'https://instagram.com/username', instagram, setInstagram, instagramEnabled, setInstagramEnabled)}
                        <View style={styles.divider} />
                        {renderLinkInput('twitter', '#0f1419', '#f1f5f9', 'Twitter / X', 'https://x.com/username', twitter, setTwitter, twitterEnabled, setTwitterEnabled)}
                        <View style={styles.divider} />
                        {renderLinkInput('linkedin', '#0077b5', '#e0f2fe', 'LinkedIn', 'https://linkedin.com/in/username', linkedin, setLinkedin, linkedinEnabled, setLinkedinEnabled)}
                        <View style={styles.divider} />
                        {renderLinkInput('youtube', '#ff0000', '#fee2e2', 'YouTube', 'https://youtube.com/@username', youtube, setYoutube, youtubeEnabled, setYoutubeEnabled)}
                        <View style={styles.divider} />
                        {renderLinkInput('globe', Colors.light.primary, '#e0f2fe', 'Website (Optional)', 'https://yourwebsite.com', website, setWebsite, websiteEnabled, setWebsiteEnabled)}
                    </View>

                    <View style={styles.tipBox}>
                        <Feather name="info" size={16} color={Colors.light.primary} style={{ marginTop: 2 }} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={styles.tipTitle}>Tip</Text>
                            <Text style={styles.tipText}>Add only the links you want to share. You can always edit them later.</Text>
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>

                <View style={styles.bottomBar}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Feather name="link" size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.saveBtnText}>Save Links</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
        justifyContent: 'flex-end',
        backgroundColor: '#f8fafc',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0px 2px 4px #0000000D',
        elevation: 2,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e0f2fe',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: Colors.light.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        boxShadow: '0px 2px 8px #0000000D',
        elevation: 2,
    },
    linkGroup: {
        flexDirection: 'row',
        paddingVertical: 12,
    },
    socialIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    inputWrapper: {
        flex: 1,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    linkLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.text,
    },
    linkInput: {
        fontSize: 14,
        color: Colors.light.text,
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginLeft: 56,
    },
    tipBox: {
        flexDirection: 'row',
        backgroundColor: '#eef2ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 40,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.primary,
        marginBottom: 4,
    },
    tipText: {
        fontSize: 13,
        color: '#4f46e5',
        lineHeight: 18,
    },
    bottomBar: {
        padding: 20,
        backgroundColor: '#f8fafc',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    saveBtn: {
        backgroundColor: Colors.light.primary,
        flexDirection: 'row',
        paddingVertical: 16,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: `0px 4px 8px ${Colors.light.primary}4D`,
        elevation: 4,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
