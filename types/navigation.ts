import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  DebtDetail: {
    debt: string | {
      id: string;
      name: string;
      type: 'owe' | 'owed';
      amount: number;
      youwillreceive: number;
      youwillgive: number;
      description?: string;
      pay_date?: string;
    };
  };
  GroupsDetail: {
    groupId: number;
  };
  CreateGroup: undefined;
  Notification: undefined;
  AddDebt: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Groups: undefined;
  Friends: undefined;
  Settings: undefined;
};
