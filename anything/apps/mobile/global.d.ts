import 'react-native';

declare module 'react-native/Libraries/Core/ExceptionsManager' {
  export function handleException(err: Error, isFatal: boolean): void;
}

declare module 'react-native' {
  interface ViewStyle {
    backdropFilter?: string;
    outlineStyle?: 'auto' | 'none' | 'solid' | 'dotted' | 'dashed';
  }

  interface TextStyle {
    outlineStyle?: 'auto' | 'none' | 'solid' | 'dotted' | 'dashed';
  }
}

declare module 'react-native-web-refresh-control' {
  import type { ComponentType } from 'react';
  import type { RefreshControlProps } from 'react-native';

  const RefreshControl: ComponentType<RefreshControlProps>;
  export { RefreshControl };
  export default RefreshControl;
}
