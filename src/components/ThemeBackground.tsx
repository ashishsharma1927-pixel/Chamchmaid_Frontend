import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../theme';

interface ThemeBackgroundProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export default function ThemeBackground({ children, style }: ThemeBackgroundProps) {
    return (
        <View style={[styles.container, style]}>
            {/* Background glowing effects */}
            <View style={[styles.glowBlob, { top: -100, right: -100, backgroundColor: 'rgba(249, 27, 125, 0.15)' }]} />
            <View style={[styles.glowBlob, { bottom: -100, left: -100, backgroundColor: 'rgba(105, 61, 245, 0.15)' }]} />
            
            {/* Main Content */}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    glowBlob: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.5,
    }
});
