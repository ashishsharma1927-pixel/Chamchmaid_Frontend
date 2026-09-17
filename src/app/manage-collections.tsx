import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView, Image, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme';
import client from '../api/client';
import * as ImagePicker from 'expo-image-picker';
import { safeBack } from '../utils/navigation';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48 - 16) / 2; // 24 padding each side, 16 gap

export default function ManageCollectionsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [collections, setCollections] = useState<any[]>([]);
    
    // Create Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollections = async () => {
        try {
            const response = await client.get('/api/collections/');
            setCollections(response.data);
        } catch (error) {
            console.error('Failed to fetch collections', error);
            Alert.alert('Error', 'Failed to load collections.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim()) {
            Alert.alert('Error', 'Please enter a collection name.');
            return;
        }
        
        setCreating(true);
        try {
            const response = await client.post('/api/collections/', {
                title: newTitle.trim(),
                image: 'https://images.unsplash.com/photo-1506744626753-1fa44df31c7f?w=400&q=80', // Dummy image for now
                icon: 'folder'
            });
            
            setCollections([response.data, ...collections]);
            setShowCreateModal(false);
            setNewTitle('');
        } catch (error) {
            console.error('Failed to create collection', error);
            Alert.alert('Error', 'Could not create collection.');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert('Delete Collection', 'Are you sure you want to delete this collection?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        await client.delete(`/api/collections/${id}/`);
                        setCollections(collections.filter(c => c.id !== id));
                    } catch (error) {
                        console.error('Failed to delete', error);
                        Alert.alert('Error', 'Could not delete collection.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveBtn} onPress={() => safeBack('/edit-profile')}>
                    <Text style={styles.saveBtnText}>Done</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.titleSection}>
                    <View style={styles.iconCircle}>
                        <Feather name="layers" size={24} color={Colors.light.primary} />
                    </View>
                    <Text style={styles.headerTitle}>My Collections</Text>
                    <Text style={styles.headerSubtitle}>
                        Showcase what matters to you
                    </Text>
                </View>

                {/* Filter tags (Visual only based on mockup) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
                    <View style={styles.tagsContainer}>
                        <View style={[styles.tag, styles.tagActive]}>
                            <Text style={[styles.tagText, styles.tagTextActive]}>All</Text>
                        </View>
                        <View style={styles.tag}><Text style={styles.tagText}>Travel</Text></View>
                        <View style={styles.tag}><Text style={styles.tagText}>Work</Text></View>
                        <View style={styles.tag}><Text style={styles.tagText}>Nature</Text></View>
                        <View style={styles.tag}><Text style={styles.tagText}>Food</Text></View>
                    </View>
                </ScrollView>

                {/* Grid */}
                <View style={styles.grid}>
                    {collections.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.collectionCard} onLongPress={() => handleDelete(item.id)}>
                            <Image 
                                source={{ uri: item.image || 'https://images.unsplash.com/photo-1506744626753-1fa44df31c7f?w=400&q=80' }} 
                                style={styles.collectionImage} 
                            />
                            <TouchableOpacity 
                                style={styles.moreBtn}
                                onPress={() => handleDelete(item.id)}
                            >
                                <Feather name="more-horizontal" size={16} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={styles.collectionInfo}>
                                <View style={styles.collectionTitleRow}>
                                    <View style={styles.collectionIconBox}>
                                        <Feather name={item.icon as any || 'folder'} size={14} color={Colors.light.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.collectionTitle} numberOfLines={1}>{item.title}</Text>
                                        <Text style={styles.collectionItems}>{item.items_count} items</Text>
                                    </View>
                                    <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Create New Button */}
                <TouchableOpacity style={styles.createBox} onPress={() => setShowCreateModal(true)}>
                    <View style={styles.createIconCircle}>
                        <Feather name="plus" size={20} color={Colors.light.primary} />
                    </View>
                    <Text style={styles.createTitle}>Create New Collection</Text>
                    <Text style={styles.createSubtitle}>Add a new collection to organize your favorite content.</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.saveBtn} onPress={() => safeBack('/edit-profile')}>
                    <Feather name="settings" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Manage Collections</Text>
                </TouchableOpacity>
            </View>

            {/* Create Collection Modal */}
            <Modal visible={showCreateModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Collection</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Collection Name"
                            value={newTitle}
                            onChangeText={setNewTitle}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreateModal(false); setNewTitle(''); }}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalCreate} onPress={handleCreate} disabled={creating}>
                                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalCreateText}>Create</Text>}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
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
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
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
    },
    tagsScroll: {
        marginBottom: 24,
    },
    tagsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        alignItems: 'center',
        gap: 24, // Matches the text gap in the mockup
    },
    tag: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    tagActive: {
        backgroundColor: Colors.light.primary,
    },
    tagText: {
        fontSize: 14,
        color: Colors.light.textMuted,
        fontWeight: '500',
    },
    tagTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 24,
        gap: 16,
        marginBottom: 24,
    },
    collectionCard: {
        width: COLUMN_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0px 2px 8px #0000000D',
        elevation: 2,
    },
    collectionImage: {
        width: '100%',
        height: 90,
    },
    moreBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectionInfo: {
        padding: 12,
    },
    collectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    collectionIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    collectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 2,
    },
    collectionItems: {
        fontSize: 11,
        color: Colors.light.textMuted,
    },
    createBox: {
        marginHorizontal: 24,
        padding: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    createIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    createTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.light.primary,
        marginBottom: 4,
    },
    createSubtitle: {
        fontSize: 12,
        color: Colors.light.textMuted,
        textAlign: 'center',
    },
    bottomBar: {
        padding: 20,
        backgroundColor: '#f8fafc',
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: Colors.light.text,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalCancel: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    modalCancelText: {
        color: Colors.light.text,
        fontWeight: '600',
    },
    modalCreate: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: Colors.light.primary,
        alignItems: 'center',
    },
    modalCreateText: {
        color: '#fff',
        fontWeight: '600',
    },
});
