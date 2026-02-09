import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Rect, Path } from 'react-native-svg';
import { theme } from '@/theme';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  text?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ text = 'Iniciando aplicación...' }) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1ECAD0', '#DCC8FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative circles */}
      <MotiView
        style={styles.decorativeCircle1}
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.1, scale: 1 }}
        transition={{ duration: 1000, delay: 200 }}
      />
      <MotiView
        style={styles.decorativeCircle2}
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 1000, delay: 400 }}
      />
      <MotiView
        style={styles.decorativeCircle3}
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.1, scale: 1 }}
        transition={{ duration: 1000, delay: 600 }}
      />

      {/* Main icon */}
      <MotiView
        from={{ opacity: 0, scale: 0.5, translateY: 50 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 150,
          delay: 300,
        }}
        style={styles.iconContainer}
      >
        <Svg width={200} height={200} viewBox="0 0 1024 1024">
          <Rect x="212" y="212" width="600" height="600" rx="40" fill="white" opacity="0.95" />
          <Rect x="252" y="252" width="520" height="80" rx="20" fill="#1ECAD0" opacity="0.8" />
          <Circle cx="292" cy="292" r="12" fill="white" />
          <Circle cx="332" cy="292" r="12" fill="white" opacity="0.7" />
          <Circle cx="372" cy="292" r="12" fill="white" opacity="0.5" />
          <Rect x="292" y="420" width="60" height="180" rx="10" fill="#DCC8FF" />
          <Rect x="372" y="380" width="60" height="220" rx="10" fill="#A88CFF" />
          <Rect x="452" y="440" width="60" height="160" rx="10" fill="#DCC8FF" />
          <Rect x="532" y="360" width="60" height="240" rx="10" fill="#1ECAD0" />
          <Rect x="612" y="400" width="60" height="200" rx="10" fill="#4DD9DE" />
          <Circle cx="322" cy="400" r="8" fill="#1F2A44" />
          <Circle cx="402" cy="360" r="8" fill="#1F2A44" />
          <Circle cx="482" cy="420" r="8" fill="#1F2A44" />
          <Circle cx="562" cy="340" r="8" fill="#1F2A44" />
          <Circle cx="642" cy="380" r="8" fill="#1F2A44" />
          <Path
            d="M322 400 L402 360 L482 420 L562 340 L642 380"
            stroke="#1F2A44"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
          />
          <Rect x="292" y="660" width="140" height="80" rx="15" fill="#1ECAD0" opacity="0.2" />
          <Rect x="442" y="660" width="140" height="80" rx="15" fill="#DCC8FF" opacity="0.3" />
          <Rect x="592" y="660" width="140" height="80" rx="15" fill="#A88CFF" opacity="0.2" />
        </Svg>
      </MotiView>

      {/* Loading dots */}
      <MotiView style={styles.dotsContainer}>
        {[0, 1, 2].map((index) => (
          <MotiView
            key={index}
            style={styles.dot}
            from={{ opacity: 0.3, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.2 }}
            transition={{
              type: 'timing',
              duration: 800,
              loop: true,
              delay: index * 200,
              repeatReverse: true,
            }}
          />
        ))}
      </MotiView>

      {/* Loading text */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 600, delay: 800 }}
      >
        <Text style={styles.text}>{text}</Text>
      </MotiView>

      {/* App name */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 800, delay: 1000 }}
        style={styles.appNameContainer}
      >
        <Text style={styles.appName}>Caja</Text>
        <Text style={styles.appNameHighlight}>Joanis</Text>
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'white',
    top: height * 0.1,
    left: -50,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'white',
    top: height * 0.6,
    right: -30,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'white',
    bottom: height * 0.15,
    left: width * 0.2,
  },
  iconContainer: {
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  text: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    fontFamily: 'Baloo2_500Medium',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    color: 'white',
    fontFamily: 'Baloo2_700Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  appNameHighlight: {
    fontSize: 32,
    color: 'white',
    fontFamily: 'Baloo2_700Bold',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});

export default SplashScreen;
