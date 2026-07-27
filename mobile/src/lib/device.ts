import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export interface DeviceMetadata {
  deviceName: string;
  deviceOS: string;
  appVersion: string;
}

/**
 * Collects and returns standard device metadata.
 */
export function getDeviceMetadata(): DeviceMetadata {
  let model = Device.modelName;
  if (!model && Platform.OS === 'web') {
    model = 'Browser';
  } else if (!model) {
    model = Platform.select({ ios: 'iPhone', android: 'Android Device', default: 'Unknown Device' });
  }

  const osName = Platform.select({ ios: 'iOS', android: 'Android', web: 'Web', default: 'OS' });
  const osVersion = Device.osVersion || '';
  const deviceOS = osVersion ? `${osName} ${osVersion}` : osName;

  // Empty, never a made-up number. On the web build and in Expo Go this is
  // null, and substituting a low version would make the server's minimum-version
  // gate reject those clients outright — the gate is written to fail open on a
  // missing version, so pass the absence through instead of inventing one.
  const appVersion = Application.nativeApplicationVersion ?? '';

  return {
    deviceName: model,
    deviceOS,
    appVersion,
  };
}
