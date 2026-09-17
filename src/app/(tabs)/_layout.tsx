import React, { useRef, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Platform, DeviceEventEmitter, Pressable, Animated, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [barWidth, setBarWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [state.index]);

  const TAB_COUNT = state.routes.length;
  const tabWidth = barWidth / TAB_COUNT;

  const translateX = slideAnim.interpolate({
    inputRange: state.routes.map((_: any, i: number) => i),
    outputRange: state.routes.map((_: any, i: number) => (tabWidth * i) + (tabWidth / 2) - 23),
  });

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20,
        ...(Platform.OS === 'web' ? { alignSelf: 'center', width: 450 } : { left: 0, right: 0, marginHorizontal: 20 }),
        elevation: 10,
        shadowColor: '#8A2BE2',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        borderRadius: 40,
        height: 65,
      }}
    >
      <BlurView
        intensity={isDark ? 60 : 80}
        tint={isDark ? "dark" : "light"}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(20, 20, 30, 0.35)' : 'rgba(255, 255, 255, 0.6)',
          borderRadius: 40,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
      {barWidth > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            width: 46,
            height: 46,
            borderRadius: 23,
            transform: [{ translateX }],
            shadowColor: '#FF2A85',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 5,
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={['#FF9A00', '#FF2A85', '#8A2BE2', '#00E5FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}

      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        let iconName = 'home';
        if (route.name === 'search') iconName = 'search';
        if (route.name === 'add') iconName = 'plus-circle';
        if (route.name === 'messages') iconName = 'message-square';
        if (route.name === 'profile') iconName = 'user';

        const onPress = () => {
          if (route.name === 'add') {
            DeviceEventEmitter.emit('triggerAddPost');
            return;
          }

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            android_ripple={null}
            style={{ flex: 1, height: 65, justifyContent: 'center', alignItems: 'center' }}
          >
            <Feather 
              name={iconName as any} 
              size={route.name === 'add' ? 28 : 24} 
              color={isFocused ? "#FFF" : (route.name === 'add' ? '#FF2A85' : (isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'))} 
              style={(!isFocused && route.name !== 'add') ? {
                textShadowColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 6,
              } : undefined}
            />
          </Pressable>
        );
      })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
