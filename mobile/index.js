/**
 * Wasel Mobile App Entry Point
 * @format
 */

import { AppRegistry } from 'react-native';
// Must stay first: wraps StyleSheet.create so every text style uses the brand font.
import './src/styles/installFonts';
import App from './src/App';
import appConfig from './app.json';

AppRegistry.registerComponent(appConfig.expo.name, () => App);
