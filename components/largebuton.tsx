import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';

interface LargeButtonProps extends TouchableOpacityProps {
  title: string;
  backgroundColor?: string;
  textColor?: string;
  variant?: 'filled' | 'outlined';
  fullWidth?: boolean;
}

export default function LargeButton({ 
  title, 
  backgroundColor = 'bg-gray-800', 
  textColor = 'text-white',
  variant = 'filled',
  fullWidth = true,
  className = '',
  ...props 
}: LargeButtonProps) {
  
  const getButtonClasses = () => {
    const widthClass = fullWidth ? 'w-full' : '';
    const baseClasses = `rounded-lg py-6 px-8 justify-center items-center ${widthClass}`;
    
    if (variant === 'outlined') {
      return `${baseClasses} bg-white border-2 border-gray-300 ${className}`;
    }
    
    return `${baseClasses} ${backgroundColor} ${className}`;
  };

  const getTextClasses = () => {
    if (variant === 'outlined') {
      return 'text-center font-bold text-xl text-gray-900';
    }
    
    return `text-center font-bold text-xl ${textColor}`;
  };

  return (
    <TouchableOpacity 
      className={getButtonClasses()}
      {...props}
    >
      <Text className={getTextClasses()}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
