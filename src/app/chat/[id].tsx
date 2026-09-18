// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Modal, DeviceEventEmitter } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../theme';
import { safeBack } from '../../utils/navigation';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import client from '../../api/client';
import { WS_URL } from '../../config';

export default function ChatRoomScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [messages, setMessages] = useState<any[]>([]);
    const [otherUser, setOtherUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [messageInput, setMessageInput] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [isPinned, setIsPinned] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const ws = useRef<WebSocket | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const isInitialLoad = useRef(true);

    // Scroll to bottom every time messages change
    useEffect(() => {
        if (messages.length === 0) return;
        // Small timeout ensures FlatList has rendered the items
        const timer = setTimeout(() => {
            flatListRef.current?.scrollToEnd({
                animated: !isInitialLoad.current  // no animation on first load, smooth on new messages
            });
            isInitialLoad.current = false;
        }, 100);
        return () => clearTimeout(timer);
    }, [messages.length]);

    // Helper: mark all messages as read and refresh the nav badge
    const markRoomRead = async (rmId: string) => {
        try {
            await client.post(`/chat/api/room/${rmId}/mark_read/`);
            // Tell nav bar to refresh its badge count
            const res = await client.get('/chat/api/unread_summary/');
            DeviceEventEmitter.emit('unreadCountUpdate', { count: res.data.unread_senders || 0 });
        } catch (_) {}
    };

    useEffect(() => {
        const initializeChat = async () => {
            try {
                // 1. Start Chat API to get Room ID
                const startRes = await client.get(`/chat/start/${id}/`);
                const rmId = startRes.data.room_id;
                setRoomId(rmId);

                // 2. Fetch Room Data and Message History
                const roomRes = await client.get(`/chat/api/room/${rmId}/`);
                const other = roomRes.data.other_user;
                setOtherUser(other);
                setCurrentUserId(roomRes.data.current_user_id);
                setMessages(roomRes.data.messages || []);
                setIsPinned(roomRes.data.is_pinned || false);
                setLoading(false);

                // 3. Mark all messages as read immediately on open
                markRoomRead(rmId);

                // 4. Connect WebSocket
                connectWebSocket(rmId, roomRes.data.current_user_id, other?.public_key);
            } catch (error) {
                console.error('Failed to initialize chat', error);
                setLoading(false);
            }
        };

        initializeChat();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [id]);


    const connectWebSocket = (rmId: string, userId: number, otherPublicKey?: string) => {
        const socketUrl = `${WS_URL}/ws/chat/${rmId}/`;
        const socket = new WebSocket(socketUrl);

        socket.onopen = () => {
            console.log('WebSocket Connected');
        };

        socket.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            if (data.action === 'send') {
                // Map WebSocket payload to match REST API format
                const mappedData = {
                    ...data,
                    content: data.message
                };
                setMessages(prev => [...prev, mappedData]);
                // If the incoming message is from the other user, mark it read immediately
                if (data.sender_id !== userId) {
                    markRoomRead(rmId);
                }
            } else if (data.action === 'delete') {
                setMessages(prev => prev.filter(m => m.id !== data.message_id));
            } else if (data.action === 'edit') {
                setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: data.content, is_edited: true } : m));
            }
        };

        socket.onclose = () => {
            console.log('WebSocket Disconnected');
        };

        ws.current = socket;
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !ws.current || !currentUserId) return;

        const originalText = messageInput.trim();
        setMessageInput(''); // Optimistically clear input

        ws.current.send(JSON.stringify({
            action: 'send',
            message: originalText,
            sender_id: currentUserId,
            is_encrypted: false
        }));
    };

    const renderMessage = ({ item }: { item: any }) => {
        // Handle both string and number IDs for sender matching
        const isMine = item.sender_id === currentUserId || item.sender_id === currentUserId?.toString();
        
        return (
            <View style={[styles.messageWrapper, isMine ? styles.messageMine : styles.messageTheirs]}>
                {!isMine && (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{item.sender_name?.[0] || '?'}</Text>
                    </View>
                )}
                <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={styles.messageText}>{item.content}</Text>
                    <View style={styles.messageMeta}>
                        <Text style={styles.timeText}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {item.is_edited && <Text style={styles.editedText}>(edited)</Text>}
                    </View>
                </View>
            </View>
        );
    };

    const togglePin = async () => {
        setShowOptions(false);
        try {
            const res = await client.post(`/chat/api/room/${roomId}/pin/`);
            setIsPinned(res.data.is_pinned);
        } catch (e) {
            console.error('Failed to toggle pin', e);
        }
    };

    const confirmClearChat = () => {
        setShowOptions(false);
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete all messages in this chat? This cannot be undone.")) {
                clearChat();
            }
        } else {
            Alert.alert(
                "Delete Chat",
                "Are you sure you want to delete all messages in this chat? This cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: clearChat }
                ]
            );
        }
    };

    const clearChat = async () => {
        try {
            await client.post(`/chat/api/room/${roomId}/clear/`);
            setMessages([]);
        } catch (error) {
            console.error('Failed to clear chat', error);
        }
    };

    const displayMessages = searchQuery 
        ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
        : messages;

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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={Colors.light.text} />
                </TouchableOpacity>

                {showSearch ? (
                    <View style={styles.searchHeader}>
                        <Feather name="search" size={18} color={Colors.light.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search chat..."
                            placeholderTextColor={Colors.light.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }} style={{ padding: 4 }}>
                            <Feather name="x" size={20} color={Colors.light.text} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity 
                            style={styles.headerInfo}
                            onPress={() => router.push(`/chat/connection/${id}`)}
                        >
                            {otherUser?.profile_image ? (
                                <Image source={{ uri: otherUser.profile_image }} style={styles.headerAvatar} />
                            ) : (
                                <View style={styles.headerAvatarPlaceholder}>
                                    <Text style={styles.headerAvatarText}>{otherUser?.name?.[0] || '?'}</Text>
                                </View>
                            )}
                            <Text style={styles.headerName}>{otherUser?.name || 'Chat'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowOptions(true)} style={styles.optionsBtn}>
                            <Feather name="smile" size={24} color={Colors.light.text} />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <View style={styles.chatBackgroundWrapper}>
                <Image 
                    source={require('../../../assets/images/logo.png')} 
                    style={styles.fixedBackgroundImage}
                />
            </View>

            <KeyboardAvoidingView 
                style={styles.chatContainer} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <FlatList
                    ref={flatListRef}
                    data={displayMessages}
                    keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={Colors.light.textMuted}
                        value={messageInput}
                        onChangeText={setMessageInput}
                        multiline
                        onKeyPress={(e: any) => {
                            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, !messageInput.trim() && styles.sendButtonDisabled]} 
                        onPress={sendMessage}
                        disabled={!messageInput.trim()}
                    >
                        <Feather name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Options Modal */}
            <Modal
                visible={showOptions}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowOptions(false)}
                >
                    <View style={styles.dropdownMenu}>
                        <TouchableOpacity style={styles.dropdownItem} onPress={togglePin}>
                            <Feather name="star" size={18} color={isPinned ? '#f59e0b' : Colors.light.text} />
                            <Text style={[styles.dropdownItemText, isPinned && { color: '#f59e0b' }]}>
                                {isPinned ? 'Unpin Chat' : 'Pin Chat'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.dropdownDivider} />
                        
                        <TouchableOpacity 
                            style={styles.dropdownItem} 
                            onPress={() => { setShowOptions(false); router.push(`/user/${id}`); }}
                        >
                            <Feather name="user" size={18} color={Colors.light.text} />
                            <Text style={styles.dropdownItemText}>View Profile</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.dropdownDivider} />
                        
                        <TouchableOpacity 
                            style={styles.dropdownItem} 
                            onPress={() => { setShowOptions(false); setShowSearch(true); }}
                        >
                            <Feather name="search" size={18} color={Colors.light.text} />
                            <Text style={styles.dropdownItemText}>Search Chat</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.dropdownDivider} />
                        
                        <TouchableOpacity style={styles.dropdownItem} onPress={confirmClearChat}>
                            <Feather name="trash-2" size={18} color={Colors.light.error} />
                            <Text style={[styles.dropdownItemText, { color: Colors.light.error }]}>Delete All Chat</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        backgroundColor: Colors.light.surface,
    },
    backButton: {
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    headerAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    headerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    chatContainer: {
        flex: 1,
    },
    chatBackgroundWrapper: {
        position: 'absolute',
        top: 70,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.light.background,
    },
    fixedBackgroundImage: {
        width: '70%',
        height: '70%',
        resizeMode: 'contain',
        opacity: 0.08,
    },
    messageList: {
        padding: 16,
        paddingBottom: 20,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    messageMine: {
        justifyContent: 'flex-end',
    },
    messageTheirs: {
        justifyContent: 'flex-start',
    },
    avatarPlaceholder: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 12,
        borderRadius: 16,
    },
    bubbleMine: {
        backgroundColor: Colors.light.primary,
        borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
        backgroundColor: Colors.dark.surface,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    messageText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 6,
    },
    timeText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
    },
    editedText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        fontStyle: 'italic',
    },
    myMessageText: {
        color: '#fff',
    },
    messageTime: {
        fontSize: 10,
        color: Colors.light.textMuted,
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    optionsBtn: {
        padding: 4,
        marginLeft: 12,
    },
    searchHeader: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.background,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 36,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: 15,
        color: Colors.light.text,
        outlineStyle: 'none',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 60,
        right: 16,
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        paddingVertical: 8,
        minWidth: 180,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    dropdownItemText: {
        fontSize: 15,
        color: Colors.light.text,
        fontWeight: '500',
    },
    dropdownDivider: {
        height: 1,
        backgroundColor: Colors.light.border,
        marginHorizontal: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: Colors.dark.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        color: Colors.dark.text,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 100,
        fontSize: 15,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    sendButton: {
        backgroundColor: Colors.dark.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
        marginBottom: 2,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.dark.border,
        opacity: 0.5,
    }
});
