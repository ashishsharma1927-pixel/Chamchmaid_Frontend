import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import * as SecureStore from './storage';

// Helper to convert strings to Uint8Array
const encodeUTF8 = (text: string) => util.decodeUTF8(text);
const decodeUTF8 = (arr: Uint8Array) => util.encodeUTF8(arr);

// Keys are base64 encoded for storage/transport
const encodeBase64 = (arr: Uint8Array) => util.encodeBase64(arr);
const decodeBase64 = (b64: string) => util.decodeBase64(b64);

const PRIVATE_KEY_STORE = 'e2ee_private_key';
const PUBLIC_KEY_STORE = 'e2ee_public_key';

export const cryptoUtils = {
    /**
     * Get or generate the keypair for the current user.
     * Returns the public key in Base64 format.
     */
    async getOrGenerateKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
        const storedPriv = await SecureStore.getItemAsync(PRIVATE_KEY_STORE);
        const storedPub = await SecureStore.getItemAsync(PUBLIC_KEY_STORE);
        
        if (storedPriv && storedPub) {
            return { publicKey: storedPub, privateKey: storedPriv };
        }

        const keyPair = nacl.box.keyPair();
        const publicKeyB64 = encodeBase64(keyPair.publicKey);
        const privateKeyB64 = encodeBase64(keyPair.secretKey);

        await SecureStore.setItemAsync(PRIVATE_KEY_STORE, privateKeyB64);
        await SecureStore.setItemAsync(PUBLIC_KEY_STORE, publicKeyB64);

        return { publicKey: publicKeyB64, privateKey: privateKeyB64 };
    },

    /**
     * Clear keys (useful on logout)
     */
    async clearKeys() {
        await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE);
        await SecureStore.deleteItemAsync(PUBLIC_KEY_STORE);
    },

    /**
     * Encrypt a message for a specific receiver using their public key.
     */
    async encryptMessage(message: string, receiverPublicKeyB64: string): Promise<string> {
        if (!receiverPublicKeyB64) return message; // fallback if no key
        try {
            const { privateKey } = await this.getOrGenerateKeyPair();
            
            const mySecretKey = decodeBase64(privateKey);
            const theirPublicKey = decodeBase64(receiverPublicKeyB64);
            
            const nonce = nacl.randomBytes(nacl.box.nonceLength);
            const messageUint8 = encodeUTF8(message);
            
            const encrypted = nacl.box(messageUint8, nonce, theirPublicKey, mySecretKey);
            
            // Combine nonce and encrypted message into one payload
            const payload = new Uint8Array(nonce.length + encrypted.length);
            payload.set(nonce);
            payload.set(encrypted, nonce.length);
            
            return encodeBase64(payload);
        } catch (error) {
            console.error('Encryption error:', error);
            return message;
        }
    },

    /**
     * Decrypt a message from a specific sender using their public key.
     */
    async decryptMessage(encryptedPayloadB64: string, senderPublicKeyB64: string): Promise<string> {
        if (!senderPublicKeyB64 || !encryptedPayloadB64) return encryptedPayloadB64;
        try {
            const { privateKey } = await this.getOrGenerateKeyPair();
            
            const mySecretKey = decodeBase64(privateKey);
            const theirPublicKey = decodeBase64(senderPublicKeyB64);
            
            const payload = decodeBase64(encryptedPayloadB64);
            
            const nonce = payload.slice(0, nacl.box.nonceLength);
            const encryptedMessage = payload.slice(nacl.box.nonceLength);
            
            const decrypted = nacl.box.open(encryptedMessage, nonce, theirPublicKey, mySecretKey);
            
            if (!decrypted) {
                return '[Encrypted Message]';
            }
            
            return decodeUTF8(decrypted);
        } catch (error) {
            return '[Encrypted Message]';
        }
    }
};
