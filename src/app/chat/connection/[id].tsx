import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../../theme';
import client from '../../../api/client';
import { safeBack } from '../../../utils/navigation';
import { LinearGradient } from 'expo-linear-gradient';

export default function ConnectionDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [connectionData, setConnectionData] = useState<any>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // First get the room id using the user id (same as chat room init)
                const startRes = await client.get(`/chat/start/${id}/`);
                const rmId = startRes.data.room_id;

                // Then fetch the room details
                const roomRes = await client.get(`/chat/api/room/${rmId}/`);
                setConnectionData(roomRes.data);
            } catch (error) {
                console.error('Failed to load connection details', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id]);

    const getBondColor = (bond: string) => {
        switch (bond) {
            case 'soul_mates': return '#ec4899'; // Pink
            case 'super_duper_strong': return '#8b5cf6'; // Purple
            case 'super_strong': return '#3b82f6'; // Blue
            case 'great': return '#10b981'; // Emerald
            case 'nice': return '#f59e0b'; // Amber
            default: return '#64748b'; // Slate (Good)
        }
    };

    const formatBondName = (bond: string) => {
        if (!bond) return 'Good';
        return bond.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getBondIcon = (bond: string) => {
        switch (bond) {
            case 'soul_mates': return 'infinity';
            case 'super_duper_strong': return 'fire';
            case 'super_strong': return 'bolt';
            case 'great': return 'star';
            case 'nice': return 'thumbs-up';
            default: return 'handshake';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    if (!connectionData) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={styles.errorText}>Could not load connection details.</Text>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const { other_user, created_at, bond_level } = connectionData;
    const connectedDate = new Date(created_at).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.headerBack}>
                    <Feather name="arrow-left" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Connection Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Section */}
                <TouchableOpacity 
                    style={styles.profileSection}
                    onPress={() => router.push(`/user/${id}`)}
                >
                    <View style={styles.avatarWrapper}>
                        {other_user?.profile_image ? (
                            <Image source={{ uri: other_user.profile_image }} style={styles.largeAvatar} />
                        ) : (
                            <View style={styles.largeAvatarPlaceholder}>
                                <Text style={styles.largeAvatarText}>{other_user?.name?.[0] || '?'}</Text>
                            </View>
                        )}
                        {bond_level === 'soul_mates' && (
                            <View style={styles.soulMateBadge}>
                                <FontAwesome5 name="heart" solid size={16} color="#fff" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.profileName}>{other_user?.name || 'User'}</Text>
                    <Text style={styles.connectionDate}>Connected since {connectedDate}</Text>
                </TouchableOpacity>

                {/* Bond Level Section */}
                <View style={styles.bondSection}>
                    <Text style={styles.sectionTitle}>Your Bond</Text>
                    
                    <View style={[styles.bondCard, { borderColor: getBondColor(bond_level) }]}>
                        <View style={[styles.bondIconBg, { backgroundColor: getBondColor(bond_level) + '20' }]}>
                            <FontAwesome5 name={getBondIcon(bond_level)} size={32} color={getBondColor(bond_level)} />
                        </View>
                        
                        <View style={styles.bondInfo}>
                            <Text style={styles.bondLevelText} numberOfLines={1}>
                                {formatBondName(bond_level)}
                            </Text>
                            <Text style={styles.bondDescription}>
                                Interact more to increase your bond!
                            </Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        backgroundColor: Colors.light.surface,
    },
    headerBack: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    scrollContent: {
        padding: 20,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 20,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 16,
    },
    largeAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: Colors.light.surface,
    },
    largeAvatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.light.surface,
    },
    largeAvatarText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    soulMateBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#ec4899',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.light.background,
    },
    profileName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 4,
    },
    connectionDate: {
        fontSize: 14,
        color: Colors.light.textMuted,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 16,
    },
    bondSection: {
        marginBottom: 30,
    },
    bondCard: {
        flexDirection: 'row',
        backgroundColor: Colors.light.surface,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    bondIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    bondInfo: {
        flex: 1,
    },
    bondLevelText: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.light.text,
        marginBottom: 4,
    },
    bondDescription: {
        fontSize: 13,
        color: Colors.light.textMuted,
        lineHeight: 18,
    },
    errorText: {
        fontSize: 16,
        color: Colors.light.text,
        marginBottom: 16,
    },
    backBtn: {
        backgroundColor: Colors.light.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    }
});
