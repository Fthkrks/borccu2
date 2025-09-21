import React from 'react';
import { Pressable, PressableProps, StyleSheet, Text } from 'react-native';
import '../global.css';

interface ButtonProps extends PressableProps {
  title: string;
  backgroundColor?: string;
  textColor?: string;
  variant?: 'filled' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  shape?: 'rounded' | 'rectangular';
}

export default function Button({ 
  title, 
  backgroundColor = 'bg-gray-800', 
  textColor = 'text-white',
  variant = 'filled',
  size = 'medium',
  shape = 'rounded',
  className = '',
  ...props 
}: ButtonProps) {
  
  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    // Size styles
    if (size === 'small') baseStyle.push(styles.small);
    else if (size === 'large') baseStyle.push(styles.large);
    else baseStyle.push(styles.medium);
    
    // Shape styles
    if (shape === 'rounded') baseStyle.push(styles.rounded);
    else baseStyle.push(styles.rectangular);
    
    // Variant styles
    if (variant === 'outlined') {
      baseStyle.push(styles.outlined);
    } else {
      // For filled variant, we'll use a default background
      baseStyle.push(styles.filled);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text];
    
    if (variant === 'outlined') {
      baseStyle.push(styles.outlinedText);
    } else {
      baseStyle.push(styles.filledText);
    }
    
    return baseStyle;
  };

  const { onPress, ...otherProps } = props;

  return (
    <Pressable 
      style={({ pressed }) => [
        getButtonStyle(),
        pressed && { opacity: 0.7 }
      ]}
      onPress={(e) => {
        console.log('🔘 Button pressed:', title);
        if (onPress) {
          onPress(e);
        }
      }}
      {...otherProps}
    >
      <Text style={getTextStyle()}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Size styles
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  // Shape styles
  rounded: {
    borderRadius: 9999, // equivalent to rounded-full
  },
  rectangular: {
    borderRadius: 8, // equivalent to rounded-lg
  },
  // Variant styles
  filled: {
    backgroundColor: '#1F2937', // gray-800
  },
  outlined: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB', // gray-300
  },
  // Text styles
  text: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  filledText: {
    color: '#FFFFFF',
  },
  outlinedText: {
    color: '#111827', // gray-900
  },
});