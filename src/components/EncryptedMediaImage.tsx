import React, { useState, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ImageProps, StyleProp, ImageStyle } from 'react-native';
import { getOrDecryptMedia, isEncryptedMediaUrl } from '../utils/mediaCrypto';

interface EncryptedMediaImageProps extends Omit<ImageProps, 'source'> {
    uri: string | null | undefined;
    fallback?: string;
    style?: StyleProp<ImageStyle>;
}

export const EncryptedMediaImage: React.FC<EncryptedMediaImageProps> = ({
    uri,
    fallback,
    style,
    ...rest
}) => {
    const [displayUri, setDisplayUri] = useState<string | null>(() => {
        if (!uri) return fallback || null;
        if (!isEncryptedMediaUrl(uri)) return uri;
        return null;
    });
    const [loading, setLoading] = useState<boolean>(() => isEncryptedMediaUrl(uri));

    useEffect(() => {
        let isMounted = true;

        if (!uri) {
            setDisplayUri(fallback || null);
            setLoading(false);
            return;
        }

        if (!isEncryptedMediaUrl(uri)) {
            setDisplayUri(uri);
            setLoading(false);
            return;
        }

        // Encrypted URL: Resolve from local cache or download & decrypt
        setLoading(true);
        getOrDecryptMedia(uri)
            .then((localPath) => {
                if (isMounted) {
                    setDisplayUri(localPath);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error('Failed to load encrypted media:', err);
                if (isMounted) {
                    setDisplayUri(fallback || uri);
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [uri, fallback]);

    if (!displayUri) {
        return (
            <View style={[styles.placeholder, style]}>
                {loading && <ActivityIndicator color="#ec4899" size="small" />}
            </View>
        );
    }

    return (
        <Image
            source={{ uri: displayUri }}
            style={style}
            {...rest}
        />
    );
};

const styles = StyleSheet.create({
    placeholder: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default EncryptedMediaImage;
